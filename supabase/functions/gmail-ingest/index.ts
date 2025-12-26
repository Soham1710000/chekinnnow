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
    const errorText = await response.text();
    console.error('[gmail-ingest] Failed to get access token for user:', userId, errorText);
    
    // If token refresh fails, pause the user
    if (errorText.includes('invalid_grant') || errorText.includes('Token has been expired or revoked')) {
      console.log('[gmail-ingest] Gmail access revoked, pausing user:', userId);
      await supabase
        .from('chekinn_users')
        .update({ status: 'paused' })
        .eq('id', userId);
    }
    
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

async function processUserEmails(supabase: any, userId: string, accessToken: string): Promise<{ processed: number; signals: number; profiles: number }> {
  console.log('[gmail-ingest] Processing emails for user:', userId);
  
  // Get last processed timestamp
  const { data: lastJob } = await supabase
    .from('ingestion_jobs')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const afterDate = lastJob?.completed_at 
    ? new Date(lastJob.completed_at)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
  
  const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
  const query = `after:${afterTimestamp} -category:promotions -category:social`;
  
  let processed = 0;
  let signalsFound = 0;
  let profilesFound = 0;
  let pageToken: string | null = null;
  const emailsForExtraction: EmailForExtraction[] = [];
  const emailsForSocialInference: EmailForExtraction[] = [];
  const processedMessageIds = new Set<string>();

  // Get already processed message IDs to ensure idempotency
  const { data: existingSignals } = await supabase
    .from('email_signals')
    .select('gmail_message_id')
    .eq('user_id', userId);
  
  if (existingSignals) {
    existingSignals.forEach((s: any) => processedMessageIds.add(s.gmail_message_id));
  }

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
      // Skip already processed emails (idempotency)
      if (processedMessageIds.has(msg.id)) {
        continue;
      }

      try {
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

        // Extract body text
        let body = snippet;
        const parts = msgData.payload?.parts || [];
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            break;
          }
        }
        if (body === snippet && msgData.payload?.body?.data) {
          body = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        body = body.slice(0, 2000);

        const emailData: EmailForExtraction = {
          messageId: msg.id,
          subject,
          from,
          date: dateStr || new Date(parseInt(msgData.internalDate || Date.now())).toISOString(),
          body,
        };

        // All emails go to social inference (for LinkedIn/Twitter detection)
        emailsForSocialInference.push(emailData);

        // Only potentially relevant emails go to signal extraction
        if (mightContainSignal(subject, snippet)) {
          emailsForExtraction.push(emailData);
        }

      } catch (err) {
        console.error('[gmail-ingest] Error processing message:', err);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  } while (pageToken && emailsForExtraction.length < 100);

  console.log(`[gmail-ingest] Sending ${emailsForExtraction.length} emails to signal extraction`);
  console.log(`[gmail-ingest] Sending ${emailsForSocialInference.length} emails to social inference`);

  // Step 2: Extract signals from relevant emails
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

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 3: Infer social profiles from all emails
  for (let i = 0; i < emailsForSocialInference.length; i += batchSize) {
    const batch = emailsForSocialInference.slice(i, i + batchSize);
    
    try {
      const inferResponse = await fetch(`${SUPABASE_URL}/functions/v1/infer-social`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails: batch, userId }),
      });

      if (inferResponse.ok) {
        const result = await inferResponse.json();
        profilesFound += result.profilesInserted || 0;
      } else {
        console.error('[gmail-ingest] Social inference failed:', await inferResponse.text());
      }
    } catch (err) {
      console.error('[gmail-ingest] Error calling infer-social:', err);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 4: Scrape high-confidence social profiles
  try {
    const scrapeResponse = await fetch(`${SUPABASE_URL}/functions/v1/scrape-social`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (scrapeResponse.ok) {
      const result = await scrapeResponse.json();
      console.log(`[gmail-ingest] Scraped ${result.scraped} profiles, ${result.signalsCreated} signals`);
    }
  } catch (err) {
    console.error('[gmail-ingest] Error calling scrape-social:', err);
  }

  // Step 5: Run decision engine (considers both email and social signals)
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

  return { processed, signals: signalsFound, profiles: profilesFound };
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
      
      // Only process active users (not paused due to revoked access)
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
              error_message: 'Failed to get access token - Gmail access may be revoked',
            })
            .eq('id', job.id);
          results[userId] = { error: 'Gmail access revoked or expired' };
          continue;
        }

        const { processed, signals, profiles } = await processUserEmails(supabase, userId, accessToken);

        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            emails_processed: processed,
            signals_found: signals,
          })
          .eq('id', job.id);

        results[userId] = { processed, signals, profiles };
        console.log(`[gmail-ingest] Completed for user ${userId}: ${processed} emails, ${signals} signals, ${profiles} profiles`);

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