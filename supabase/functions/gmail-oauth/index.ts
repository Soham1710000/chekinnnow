import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Gmail read-only scope ONLY
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'email', 'profile'];

// Simple encryption using Web Crypto API
async function encrypt(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TOKEN_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(text)
  );
  
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TOKEN_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  );
  
  return decoder.decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Allow action to be provided via query param (GET) OR JSON body (POST).
    let action = url.searchParams.get('action') ?? undefined;
    let body: any = null;

    if (!action && req.method !== 'GET') {
      try {
        body = await req.json();
        action = body?.action;
      } catch {
        // ignore parse errors; handled by per-action validation
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Action: Get OAuth URL for user to authorize
    if (action === 'authorize') {
      const redirectUri = url.searchParams.get('redirect_uri') ?? body?.redirect_uri;
      if (!redirectUri) {
        return new Response(JSON.stringify({ error: 'redirect_uri required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const state = crypto.randomUUID();
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);

      console.log('[gmail-oauth] Generated auth URL for redirect:', redirectUri);

      return new Response(JSON.stringify({
        authUrl: authUrl.toString(),
        state,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Exchange code for tokens and store user
    if (action === 'callback') {
      if (!body) {
        return new Response(JSON.stringify({ error: 'JSON body required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { code, redirect_uri } = body;

      if (!code || !redirect_uri) {
        return new Response(JSON.stringify({ error: 'code and redirect_uri required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[gmail-oauth] Exchanging code for tokens');

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error('[gmail-oauth] Token exchange error:', tokens.error);
        return new Response(JSON.stringify({ error: tokens.error_description || tokens.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[gmail-oauth] Tokens received, fetching user info');

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      console.log('[gmail-oauth] User info received:', userInfo.email);

      // Encrypt tokens
      const accessTokenEncrypted = await encrypt(tokens.access_token);
      const refreshTokenEncrypted = await encrypt(tokens.refresh_token);
      const tokenExpiry = new Date(Date.now() + (tokens.expires_in * 1000));

      // Create or update user
      const { data: existingUser } = await supabase
        .from('chekinn_users')
        .select('id')
        .eq('email', userInfo.email)
        .single();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        await supabase
          .from('chekinn_users')
          .update({
            google_id: userInfo.id,
            consented_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', userId);
        console.log('[gmail-oauth] Updated existing user:', userId);
      } else {
        const { data: newUser, error: createError } = await supabase
          .from('chekinn_users')
          .insert({
            email: userInfo.email,
            google_id: userInfo.id,
            consented_at: new Date().toISOString(),
            status: 'active',
          })
          .select('id')
          .single();

        if (createError) {
          console.error('[gmail-oauth] Error creating user:', createError);
          throw createError;
        }
        userId = newUser.id;
        console.log('[gmail-oauth] Created new user:', userId);
      }

      // Store encrypted tokens
      const { error: tokenError } = await supabase
        .from('oauth_tokens')
        .upsert(
          {
            user_id: userId,
            access_token_encrypted: accessTokenEncrypted,
            refresh_token_encrypted: refreshTokenEncrypted,
            token_expiry: tokenExpiry.toISOString(),
            scopes: SCOPES,
          },
          { onConflict: 'user_id' }
        );

      if (tokenError) {
        console.error('[gmail-oauth] Error storing tokens:', tokenError);
        throw tokenError;
      }

      console.log('[gmail-oauth] OAuth complete for user:', userId);

      return new Response(
        JSON.stringify({
          success: true,
          userId,
          email: userInfo.email,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Action: Refresh token if needed
    if (action === 'refresh') {
      if (!body) {
        return new Response(JSON.stringify({ error: 'JSON body required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { userId } = body;

      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ error: 'No tokens found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if token is expired
      const expiry = new Date(tokenData.token_expiry);
      if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
        // Token still valid for at least 5 minutes
        const accessToken = await decrypt(tokenData.access_token_encrypted);
        return new Response(JSON.stringify({ accessToken }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Refresh the token
      console.log('[gmail-oauth] Refreshing token for user:', userId);
      const refreshToken = await decrypt(tokenData.refresh_token_encrypted);

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error('[gmail-oauth] Token refresh error:', tokens.error);
        return new Response(JSON.stringify({ error: tokens.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update stored tokens
      const accessTokenEncrypted = await encrypt(tokens.access_token);
      const newExpiry = new Date(Date.now() + (tokens.expires_in * 1000));

      await supabase
        .from('oauth_tokens')
        .update({
          access_token_encrypted: accessTokenEncrypted,
          token_expiry: newExpiry.toISOString(),
        })
        .eq('user_id', userId);

      console.log('[gmail-oauth] Token refreshed for user:', userId);

      return new Response(JSON.stringify({ accessToken: tokens.access_token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[gmail-oauth] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

