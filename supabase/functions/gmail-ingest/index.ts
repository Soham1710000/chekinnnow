import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keywords to filter relevant emails
const SIGNAL_KEYWORDS = {
  flight: ['flight', 'boarding pass', 'itinerary', 'airline', 'departure', 'arrival', 'booking confirmation', 'e-ticket'],
  interview: ['interview', 'interview scheduled', 'interview invitation', 'meeting with hiring', 'technical round', 'HR round'],
  offer: ['offer letter', 'job offer', 'compensation', 'joining date', 'we are pleased to offer', 'congratulations on your selection'],
  calendar_invite: ['calendar invitation', 'event invitation', 'you have been invited', 'google calendar', 'outlook calendar', '.ics'],
  event: ['event confirmation', 'ticket confirmation', 'registration confirmed', 'webinar', 'conference', 'workshop'],
  exam_confirmation: ['exam confirmation', 'test scheduled', 'admit card', 'hall ticket', 'examination', 'assessment scheduled', 'upsc', 'prelims', 'mains']
};

// Domains/senders to ignore (promotions, personal)
const IGNORE_PATTERNS = [
  'noreply@youtube.com',
  'notifications@',
  'newsletter@',
  'promo@',
  'marketing@',
  'deals@',
  'offers@',
  'unsubscribe',
  'linkedin.com/comm/',
  'facebook.com',
  'twitter.com',
  'instagram.com'
];

interface EmailSignal {
  signal_type: string;
  signal_data: Record<string, unknown>;
  email_date: string;
  gmail_message_id: string;
}

async function getAccessToken(supabase: any, userId: string): Promise<string | null> {
  // Call the gmail-oauth function to get/refresh token
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

function detectSignalType(subject: string, snippet: string): string | null {
  const combined = `${subject} ${snippet}`.toLowerCase();
  
  for (const [signalType, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
    if (keywords.some(keyword => combined.includes(keyword.toLowerCase()))) {
      return signalType;
    }
  }
  
  return null;
}

function extractSignalData(signalType: string, subject: string, snippet: string, from: string): Record<string, unknown> {
  const data: Record<string, unknown> = {
    subject,
    from,
    snippet: snippet.slice(0, 500), // Limit snippet length
  };

  // Extract specific data based on signal type
  switch (signalType) {
    case 'flight':
      // Try to extract flight number, dates
      const flightMatch = snippet.match(/([A-Z]{2}\d{3,4})/);
      if (flightMatch) data.flight_number = flightMatch[1];
      break;
    case 'interview':
      // Try to extract company name from subject/from
      const companyMatch = from.match(/@([^.]+)\./);
      if (companyMatch) data.company = companyMatch[1];
      break;
    case 'offer':
      const companyFromEmail = from.match(/@([^.]+)\./);
      if (companyFromEmail) data.company = companyFromEmail[1];
      break;
  }

  return data;
}

async function processUserEmails(supabase: any, userId: string, accessToken: string): Promise<{ processed: number; signals: number }> {
  console.log('[gmail-ingest] Processing emails for user:', userId);
  
  // Get emails from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const afterTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);

  // Build Gmail API query - exclude promotions and social
  const query = `after:${afterTimestamp} -category:promotions -category:social`;
  
  let processed = 0;
  let signalsFound = 0;
  let pageToken: string | null = null;

  do {
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('q', query);
    listUrl.searchParams.set('maxResults', '100');
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

    console.log(`[gmail-ingest] Found ${messages.length} messages to process`);

    // Process each message
    for (const msg of messages) {
      try {
        // Get message details (metadata only - not full body to minimize data)
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
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
        if (shouldIgnoreEmail(from, subject)) {
          continue;
        }

        // Detect signal type
        const signalType = detectSignalType(subject, snippet);
        if (!signalType) continue;

        // Extract signal data
        const signalData = extractSignalData(signalType, subject, snippet, from);

        // Parse email date
        let emailDate: Date;
        try {
          emailDate = new Date(dateStr);
        } catch {
          emailDate = new Date(msgData.internalDate ? parseInt(msgData.internalDate) : Date.now());
        }

        // Store signal (upsert to avoid duplicates)
        const { error } = await supabase
          .from('email_signals')
          .upsert({
            user_id: userId,
            signal_type: signalType,
            signal_data: signalData,
            email_date: emailDate.toISOString(),
            gmail_message_id: msg.id,
          }, { onConflict: 'user_id,gmail_message_id' });

        if (!error) {
          signalsFound++;
          console.log(`[gmail-ingest] Found ${signalType} signal:`, subject.slice(0, 50));
        }

      } catch (err) {
        console.error('[gmail-ingest] Error processing message:', err);
      }
    }

    // Rate limiting - don't hammer the API
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (pageToken);

  return { processed, signals: signalsFound };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this is a single user request or batch job
    let userIds: string[] = [];

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.userId) {
        userIds = [body.userId];
      }
    }

    // If no specific user, get all active users with valid tokens
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
      // Create job record
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
        // Get access token
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

        // Process emails
        const { processed, signals } = await processUserEmails(supabase, userId, accessToken);

        // Update job record
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
