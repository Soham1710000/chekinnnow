import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendLaunchEmailRequest {
  testEmail?: string; // Optional: send to a single test email
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { testEmail }: SendLaunchEmailRequest = await req.json();

    let emails: string[] = [];

    if (testEmail) {
      // Send to single test email
      emails = [testEmail];
      console.log("Sending test email to:", testEmail);
    } else {
      // Fetch all user emails from waitlist
      const { data: waitlistUsers, error } = await supabase
        .from("waitlist")
        .select("email")
        .not("email", "is", null);

      if (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to fetch users");
      }

      emails = waitlistUsers
        .map((u) => u.email)
        .filter((email): email is string => !!email);
      
      console.log(`Sending launch emails to ${emails.length} users`);
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No emails to send" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results = [];
    const errors = [];

    for (const email of emails) {
      try {
        const { data, error } = await resend.emails.send({
          from: "ChekInn <onboarding@resend.dev>",
          to: [email],
          subject: "🚀 ChekInn is Live – You're In!",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                      <!-- Header -->
                      <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                          <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827;">ChekInn</h1>
                        </td>
                      </tr>
                      
                      <!-- Main Content -->
                      <tr>
                        <td style="padding: 20px 40px;">
                          <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                            You're In! 🎉
                          </h2>
                          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                            Great news – ChekInn is now live, and you've got early access!
                          </p>
                          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                            We built ChekInn to solve a simple problem: <strong>knowing WHO to reach out to is often harder than the conversation itself.</strong>
                          </p>
                          <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                            Start a quick chat with our AI, tell us what you're looking for, and we'll introduce you to the right people. No cold DMs. No awkward networking.
                          </p>
                          
                          <!-- CTA Button -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" style="padding: 10px 0 30px;">
                                <a href="https://chekinn.app" style="display: inline-block; padding: 16px 32px; background-color: #111827; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                                  Start Connecting →
                                </a>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #4b5563;">
                            See you inside,<br>
                            <strong>The ChekInn Team</strong>
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; text-align: center;">
                          <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                            You're receiving this because you signed up for ChekInn.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });

        if (error) {
          console.error(`Failed to send to ${email}:`, error);
          errors.push({ email, error: error.message });
        } else {
          console.log(`Sent to ${email}:`, data);
          results.push({ email, id: data?.id });
        }
      } catch (err: any) {
        console.error(`Exception sending to ${email}:`, err);
        errors.push({ email, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.length,
        failed: errors.length,
        results,
        errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-launch-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
