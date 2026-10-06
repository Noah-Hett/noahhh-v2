// POST /api/contact — Cloudflare Pages Function (same setup as v1).
// Forwards the contact form to noahhett@gmail.com via Resend.
// Needs RESEND_API_KEY in the Pages project env (dashboard → Settings →
// Environment variables), same secret v1 uses.
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { name, email, message } = await request.json();

    // Validate
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(JSON.stringify({ error: 'All fields required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Escape before interpolating into the HTML body (v1 skipped this).
    const esc = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Send email using Resend API directly (no npm dep needed — plain fetch)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Portfolio Contact <onboarding@resend.dev>', // Change to your verified domain
        to: 'noahhett@gmail.com',
        subject: `Portfolio Contact from ${name.trim()}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${esc(name.trim())}</p>
          <p><strong>Email:</strong> ${esc(email.trim())}</p>
          <p><strong>Message:</strong></p>
          <p>${esc(message.trim()).replace(/\n/g, '<br>')}</p>
        `,
        reply_to: email.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
