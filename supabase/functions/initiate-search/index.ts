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
    const { query, limit = 50, hardFilterCompanyUrls } = await req.json();
    
    const CLADO_API_KEY = Deno.env.get('CLADO_API_KEY');
    if (!CLADO_API_KEY) {
      throw new Error('CLADO_API_KEY is not configured');
    }

    // Add India geography to the query
    const searchQuery = `${query} India`;
    console.log('Initiating search:', { query: searchQuery, limit });

    const body: Record<string, unknown> = { 
      query: searchQuery, 
      limit,
      // Hard filter to India geography
      hard_filter_locations: ["India"],
    };
    
    if (hardFilterCompanyUrls?.length > 0) {
      body.hard_filter_company_urls = hardFilterCompanyUrls;
    }

    const response = await fetch('https://search.clado.ai/api/search/deep_research', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLADO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Insufficient credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ error: 'Search failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    console.log('Search initiated:', data);
    
    return new Response(JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error initiating search:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
