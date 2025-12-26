import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keywords to filter relevant emails (pre-filter before LLM)
const POTENTIAL_SIGNAL_KEYWORDS = [
  'flight', 'boarding', 'itinerary', 'airline', 'departure', 'arrival', 'booking',
  'interview', 'hiring', 'technical round', 'HR round', 'screening',
  'offer letter', 'job offer', 'compensation', 'joining', 'congratulations',
  'calendar', 'event', 'invitation', 'webinar', 'conference', 'workshop', 'meetup',
  'exam', 'test', 'admit card', 'assessment', 'upsc', 'prelims', 'registration',
  'course', 'enrolled', 'subscription', 'learning', 'certification'
];

// Domains/senders to ignore
const IGNORE_PATTERNS = [
  'noreply@youtube.com', 'notifications@', 'newsletter@', 'promo@', 
  'marketing@', 'deals@', 'offers@', 'unsubscribe', 'linkedin.com/comm/',
  'facebook.com', 'twitter.com', 'instagram.com', 'pinterest.com'
];

interface EmailForExtraction {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  body: string;
}

async function getAccessToken(supabase: any, userId: string): Promise<string | null> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth?action=refresh`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    console.error('[gmail-ingest] Failed to get access token for user:', userId);
    return null;
  }

  const data = await response.json();
  return data.accessToken;
}

function shouldIgnoreEmail(from: string, subject: string): boolean {
  const combined = `${from} ${subject}`.toLowerCase();
  return IGNORE_PATTERNS.some(pattern => combined.includes(pattern.toLowerCase()));
}

function mightContainSignal(subject: string, snippet: string): boolean {
  const combined = `${subject} ${snippet}`.toLowerCase();
  return POTENTIAL_SIGNAL_KEYWORDS.some(keyword => combined.includes(keyword.toLowerCase()));
}

async function processUserEmails(supabase: any, userId: string, accessToken: string): Promise<{ processed: number; signals: number }> {
  console.log('[gmail-ingest] Processing emails for user:', userId);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const afterTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);

  const query = `after:${afterTimestamp} -category:promotions -category:social`;
  
  let processed = 0;
  let signalsFound = 0;
  let pageToken: string | null = null;
  const emailsForExtraction: EmailForExtraction[] = [];

  do {
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('q', query);
    listUrl.searchParams.set('maxResults', '50');
    if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      console.error('[gmail-ingest] Failed to list messages:', await listResponse.text());
      break;
    }

    const listData = await listResponse.json();
    const messages = listData.messages || [];
    pageToken = listData.nextPageToken || null;

    console.log(`[gmail-ingest] Found ${messages.length} messages to check`);

    for (const msg of messages) {
      try {
        // Get message with snippet for pre-filtering
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();
        processed++;

        const headers = msgData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const dateStr = headers.find((h: any) => h.name === 'Date')?.value || '';
        const snippet = msgData.snippet || '';

        // Skip ignored emails
        if (shouldIgnoreEmail(from, subject)) continue;

        // Pre-filter: only send potentially relevant emails to LLM
        if (!mightContainSignal(subject, snippet)) continue;

        // Extract body text (simplified - just get text/plain or decoded text/html)
        let body = snippet;
        const parts = msgData.payload?.parts || [];
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            break;
          }
        }
        // Fallback to payload body if no parts
        if (body === snippet && msgData.payload?.body?.data) {
          body = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        // Limit body length to save tokens
        body = body.slice(0, 2000);

        emailsForExtraction.push({
          messageId: msg.id,
          subject,
          from,
          date: dateStr || new Date(parseInt(msgData.internalDate || Date.now())).toISOString(),
          body,
        });

      } catch (err) {
        console.error('[gmail-ingest] Error processing message:', err);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  } while (pageToken && emailsForExtraction.length < 100); // Limit to 100 emails per run

  console.log(`[gmail-ingest] Sending ${emailsForExtraction.length} emails to signal extraction`);

  // Send to signal extraction in batches of 10
  const batchSize = 10;
  for (let i = 0; i < emailsForExtraction.length; i += batchSize) {
    const batch = emailsForExtraction.slice(i, i + batchSize);
    
    try {
      const extractResponse = await fetch(`${SUPABASE_URL}/functions/v1/signal-extract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails: batch, userId }),
      });

      if (extractResponse.ok) {
        const result = await extractResponse.json();
        signalsFound += result.signals || 0;
      } else {
        console.error('[gmail-ingest] Signal extraction failed:', await extractResponse.text());
      }
    } catch (err) {
      console.error('[gmail-ingest] Error calling signal-extract:', err);
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // After signal extraction, run decision engine
  try {
    const decisionResponse = await fetch(`${SUPABASE_URL}/functions/v1/decision-engine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (decisionResponse.ok) {
      const decision = await decisionResponse.json();
      console.log(`[gmail-ingest] Decision for ${userId}:`, decision.decision);
    }
  } catch (err) {
    console.error('[gmail-ingest] Error calling decision-engine:', err);
  }

  return { processed, signals: signalsFound };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userIds: string[] = [];

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.userId) {
        userIds = [body.userId];
      }
    }

    if (userIds.length === 0) {
      console.log('[gmail-ingest] Running batch job for all active users');
      
      const { data: users, error } = await supabase
        .from('chekinn_users')
        .select('id')
        .eq('status', 'active');

      if (error) throw error;
      userIds = users.map((u: any) => u.id);
    }

    console.log(`[gmail-ingest] Processing ${userIds.length} users`);

    const results: Record<string, any> = {};

    for (const userId of userIds) {
      const { data: job, error: jobError } = await supabase
        .from('ingestion_jobs')
        .insert({
          user_id: userId,
          status: 'running',
        })
        .select('id')
        .single();

      if (jobError) {
        console.error('[gmail-ingest] Failed to create job:', jobError);
        continue;
      }

      try {
        const accessToken = await getAccessToken(supabase, userId);
        if (!accessToken) {
          await supabase
            .from('ingestion_jobs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: 'Failed to get access token',
            })
            .eq('id', job.id);
          results[userId] = { error: 'Failed to get access token' };
          continue;
        }

        const { processed, signals } = await processUserEmails(supabase, userId, accessToken);

        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            emails_processed: processed,
            signals_found: signals,
          })
          .eq('id', job.id);

        results[userId] = { processed, signals };
        console.log(`[gmail-ingest] Completed for user ${userId}: ${processed} emails, ${signals} signals`);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[gmail-ingest] Error processing user:', userId, err);
        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq('id', job.id);
        results[userId] = { error: errorMessage };
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      usersProcessed: userIds.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[gmail-ingest] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
