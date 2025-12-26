import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Confidence thresholds
const SCRAPE_THRESHOLD = 0.7;

// Regex patterns for social profile detection
const LINKEDIN_PATTERNS = [
  /linkedin\.com\/in\/([a-zA-Z0-9\-_]+)/gi,
  /linkedin\.com\/company\/([a-zA-Z0-9\-_]+)/gi,
];

const TWITTER_PATTERNS = [
  /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi,
  /@([a-zA-Z0-9_]{1,15})(?:\s|$|[^a-zA-Z0-9_])/g,
];

interface EmailData {
  messageId: string;
  subject: string;
  from: string;
  body: string;
}

interface InferredProfile {
  platform: 'linkedin' | 'twitter';
  profileUrl: string;
  profileHandle?: string;
  confidence: number;
  sourceType: string;
  sourceEmailId: string;
}

function determineSourceType(from: string, subject: string, body: string): string {
  const combined = `${from} ${subject} ${body}`.toLowerCase();
  
  if (combined.includes('calendar') || combined.includes('invite') || combined.includes('event')) {
    return 'calendar';
  }
  if (combined.includes('recruit') || combined.includes('hiring') || combined.includes('job') || combined.includes('opportunity')) {
    return 'recruiter';
  }
  if (combined.includes('newsletter') || combined.includes('subscribe') || combined.includes('weekly') || combined.includes('digest')) {
    return 'newsletter';
  }
  if (combined.includes('conference') || combined.includes('meetup') || combined.includes('webinar') || combined.includes('workshop')) {
    return 'event';
  }
  // Default to email_signature for direct communications
  return 'email_signature';
}

function calculateConfidence(sourceType: string, mentionCount: number, isInSignature: boolean): number {
  let base = 0.5;
  
  // Source type weights
  const sourceWeights: Record<string, number> = {
    'email_signature': 0.25,
    'recruiter': 0.2,
    'calendar': 0.15,
    'event': 0.1,
    'newsletter': 0.05,
  };
  
  base += sourceWeights[sourceType] || 0;
  
  // Multiple mentions increase confidence
  if (mentionCount > 1) base += 0.1;
  if (mentionCount > 3) base += 0.1;
  
  // In signature = higher confidence of ownership
  if (isInSignature) base += 0.15;
  
  return Math.min(base, 0.95);
}

function isInSignature(body: string, match: string): boolean {
  // Check if the match appears in the last 20% of the email body
  const matchIndex = body.toLowerCase().indexOf(match.toLowerCase());
  if (matchIndex === -1) return false;
  
  const positionRatio = matchIndex / body.length;
  return positionRatio > 0.8;
}

function extractProfiles(email: EmailData): InferredProfile[] {
  const profiles: InferredProfile[] = [];
  const combined = `${email.from} ${email.subject} ${email.body}`;
  const sourceType = determineSourceType(email.from, email.subject, email.body);
  
  // Extract LinkedIn profiles
  for (const pattern of LINKEDIN_PATTERNS) {
    const matches = [...combined.matchAll(pattern)];
    const uniqueHandles = new Set<string>();
    
    for (const match of matches) {
      const handle = match[1];
      if (!uniqueHandles.has(handle)) {
        uniqueHandles.add(handle);
        const fullUrl = `https://linkedin.com/in/${handle}`;
        const inSig = isInSignature(email.body, match[0]);
        const confidence = calculateConfidence(sourceType, matches.length, inSig);
        
        profiles.push({
          platform: 'linkedin',
          profileUrl: fullUrl,
          profileHandle: handle,
          confidence,
          sourceType,
          sourceEmailId: email.messageId,
        });
      }
    }
  }
  
  // Extract Twitter/X profiles
  for (const pattern of TWITTER_PATTERNS) {
    const matches = [...combined.matchAll(pattern)];
    const uniqueHandles = new Set<string>();
    
    for (const match of matches) {
      const handle = match[1];
      // Filter out common words that look like handles
      if (handle.length < 3 || ['the', 'and', 'for', 'you', 'are', 'was', 'has'].includes(handle.toLowerCase())) {
        continue;
      }
      
      if (!uniqueHandles.has(handle)) {
        uniqueHandles.add(handle);
        const fullUrl = `https://x.com/${handle}`;
        const inSig = isInSignature(email.body, match[0]);
        const confidence = calculateConfidence(sourceType, matches.length, inSig);
        
        profiles.push({
          platform: 'twitter',
          profileUrl: fullUrl,
          profileHandle: handle,
          confidence,
          sourceType,
          sourceEmailId: email.messageId,
        });
      }
    }
  }
  
  return profiles;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails, userId } = await req.json();

    if (!emails || !userId) {
      return new Response(JSON.stringify({ error: 'emails and userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`[infer-social] Processing ${emails.length} emails for user ${userId}`);

    // Get already processed email IDs for this user
    const { data: userData } = await supabase
      .from('chekinn_users')
      .select('processed_email_ids')
      .eq('id', userId)
      .single();

    const processedIds = new Set(userData?.processed_email_ids || []);
    
    const allProfiles: InferredProfile[] = [];
    const newProcessedIds: string[] = [];

    for (const email of emails) {
      // Skip already processed emails (idempotency)
      if (processedIds.has(email.messageId)) {
        continue;
      }

      const profiles = extractProfiles(email);
      allProfiles.push(...profiles);
      newProcessedIds.push(email.messageId);
    }

    console.log(`[infer-social] Found ${allProfiles.length} potential profiles`);

    // Insert or update inferred profiles
    let insertedCount = 0;
    for (const profile of allProfiles) {
      const { error } = await supabase
        .from('inferred_social_profiles')
        .upsert({
          user_id: userId,
          platform: profile.platform,
          profile_url: profile.profileUrl,
          profile_handle: profile.profileHandle,
          confidence: profile.confidence,
          source_type: profile.sourceType,
          source_email_id: profile.sourceEmailId,
          scrape_status: profile.confidence >= SCRAPE_THRESHOLD ? 'pending' : 'skipped',
        }, { 
          onConflict: 'user_id,platform,profile_url',
          ignoreDuplicates: false 
        });

      if (!error) {
        insertedCount++;
      } else {
        console.error('[infer-social] Insert error:', error);
      }
    }

    // Update processed email IDs
    if (newProcessedIds.length > 0) {
      const updatedIds = [...(userData?.processed_email_ids || []), ...newProcessedIds];
      await supabase
        .from('chekinn_users')
        .update({ processed_email_ids: updatedIds })
        .eq('id', userId);
    }

    console.log(`[infer-social] Inserted/updated ${insertedCount} profiles`);

    return new Response(JSON.stringify({ 
      success: true,
      profilesFound: allProfiles.length,
      profilesInserted: insertedCount,
      emailsProcessed: newProcessedIds.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[infer-social] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});