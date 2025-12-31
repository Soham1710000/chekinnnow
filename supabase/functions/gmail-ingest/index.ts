import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYER 1: INGESTION
 * 
 * Philosophy: Zero intelligence. Store raw content without interpretation.
 * Output: raw_inputs table (immutable, append-only)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getAccessToken(supabase: any, userId: string): Promise<string | null> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'refresh', userId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[gmail-ingest] Failed to get access token for user:', userId, errorText);
    
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

async function ingestUserEmails(supabase: any, userId: string, accessToken: string, options?: { lookbackDays?: number, forceRefresh?: boolean }): Promise<{ ingested: number }> {
  console.log('[gmail-ingest] Ingesting raw emails for user:', userId);
  
  let afterDate: Date;
  
  if (options?.forceRefresh && options?.lookbackDays) {
    // Force lookback from current date
    afterDate = new Date(Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000);
    console.log(`[gmail-ingest] Force refresh: looking back ${options.lookbackDays} days`);
  } else {
    // Get last sync point
    const { data: lastInput } = await supabase
      .from('raw_inputs')
      .select('occurred_at')
      .eq('user_id', userId)
      .eq('source', 'gmail')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    afterDate = lastInput?.occurred_at 
      ? new Date(lastInput.occurred_at)
      : new Date(Date.now() - (options?.lookbackDays || 30) * 24 * 60 * 60 * 1000);
  }
  
  const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
  const query = `after:${afterTimestamp}`;
  
  console.log(`[gmail-ingest] Fetching emails after: ${afterDate.toISOString()}`);
  
  let ingested = 0;
  let pageToken: string | null = null;

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

    console.log(`[gmail-ingest] Found ${messages.length} messages`);

    for (const msg of messages) {
      try {
        // Check if already ingested (idempotency via unique constraint)
        const { data: existing } = await supabase
          .from('raw_inputs')
          .select('id')
          .eq('user_id', userId)
          .eq('source', 'gmail')
          .eq('external_id', msg.id)
          .maybeSingle();
        
        if (existing) continue;

        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();
        const headers = msgData.payload?.headers || [];
        
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const to = headers.find((h: any) => h.name === 'To')?.value || '';
        const dateStr = headers.find((h: any) => h.name === 'Date')?.value || '';
        const snippet = msgData.snippet || '';

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

        // Truncate body to 4000 chars
        body = body.slice(0, 4000);

        const occurredAt = dateStr 
          ? new Date(dateStr).toISOString()
          : new Date(parseInt(msgData.internalDate || Date.now())).toISOString();

        // Store raw input - NO INTELLIGENCE, just data
        const { error: insertError } = await supabase
          .from('raw_inputs')
          .insert({
            user_id: userId,
            source: 'gmail',
            external_id: msg.id,
            raw_text: body,
            raw_metadata: {
              subject,
              from,
              to,
              date: dateStr,
              labels: msgData.labelIds || [],
              snippet,
              thread_id: msgData.threadId,
            },
            occurred_at: occurredAt,
            processed: false,
          });

        if (!insertError) {
          ingested++;
        }

      } catch (err) {
        console.error('[gmail-ingest] Error processing message:', err);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 50));
    
  } while (pageToken); // No limit - fetch all emails in range

  return { ingested };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userIds: string[] = [];
    let ingestOptions: { lookbackDays?: number, forceRefresh?: boolean } = {};

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.userId) {
        userIds = [body.userId];
      }
      if (body.lookbackDays) {
        ingestOptions.lookbackDays = body.lookbackDays;
      }
      if (body.forceRefresh) {
        ingestOptions.forceRefresh = body.forceRefresh;
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
          results[userId] = { error: 'Gmail access revoked or expired' };
          continue;
        }

        const { ingested } = await ingestUserEmails(supabase, userId, accessToken, ingestOptions);

        // Trigger signal extraction for this user (async, don't wait)
        fetch(`${SUPABASE_URL}/functions/v1/signal-extract`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }).catch(err => console.error('[gmail-ingest] Failed to trigger signal-extract:', err));

        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            emails_processed: ingested,
          })
          .eq('id', job.id);

        results[userId] = { ingested };
        console.log(`[gmail-ingest] Completed for user ${userId}: ${ingested} raw inputs stored`);

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
