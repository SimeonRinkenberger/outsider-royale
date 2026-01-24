import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, examples, skipEntitlementCheck } = await req.json();

    if (!description || !examples || examples.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Please provide a description and at least 2 examples' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT if present
    let userId: string | null = null;
    let isPro = false;
    let aiGenerationsUsed = 0;
    const FREE_LIMIT = 2;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        
        // Check entitlement
        const { data: entitlementData } = await supabase
          .rpc('check_ai_generation_entitlement', { p_user_id: userId });
        
        if (entitlementData && entitlementData.length > 0) {
          const entitlement = entitlementData[0];
          isPro = entitlement.is_pro || false;
          aiGenerationsUsed = entitlement.ai_generations_used || 0;
          
          // Check if generation is allowed
          if (!skipEntitlementCheck && !entitlement.can_generate) {
            return new Response(
              JSON.stringify({ 
                error: 'AI generation limit reached',
                code: 'LIMIT_REACHED',
                isPro,
                aiGenerationsUsed,
                freeLimit: FREE_LIMIT,
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const prompt = `Generate a list of 20-30 words for a word guessing game category.

Category description: ${description}

Examples provided by user: ${examples.join(', ')}

Rules:
- Generate words that fit the theme/description
- Words should be similar in style and specificity to the examples
- Each word should be 1-3 words max (short phrases are okay)
- Make them diverse but all fitting the category
- Don't repeat the examples
- Output ONLY the words, one per line, nothing else`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a creative word list generator for party games. Output only the words, one per line.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate words');
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || '';
    
    // Parse words from the response
    const words = generatedText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && line.length <= 50)
      .slice(0, 30);

    if (words.length < 5) {
      throw new Error('Not enough words generated');
    }

    // Increment usage after successful generation (only if user is authenticated and not Pro)
    let newAiGenerationsUsed = aiGenerationsUsed;
    if (userId && !isPro) {
      const { data: incrementData } = await supabase
        .rpc('increment_ai_generation_usage', { p_user_id: userId });
      
      if (incrementData && incrementData.length > 0) {
        newAiGenerationsUsed = incrementData[0].ai_generations_used;
      }
    }

    return new Response(
      JSON.stringify({ 
        words,
        aiGenerationsUsed: newAiGenerationsUsed,
        freeLimit: FREE_LIMIT,
        isPro,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-category-words:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
