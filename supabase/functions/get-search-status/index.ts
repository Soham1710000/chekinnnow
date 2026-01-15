import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();
    
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const CLADO_API_KEY = Deno.env.get('CLADO_API_KEY');
    if (!CLADO_API_KEY) {
      throw new Error('CLADO_API_KEY is not configured');
    }

    console.log('Getting search status for job:', jobId);

    const response = await fetch(`https://search.clado.ai/api/search/deep_research/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLADO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Clado status error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to get status', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    console.log('Search status:', data.status);
    
    return new Response(JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error getting search status:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
