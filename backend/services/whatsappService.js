const axios = require("axios");

/**
 * Sends one WhatsApp message via Meta WhatsApp Business Cloud API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
 *
 * NOTE: For numbers that haven't messaged your business in the last 24 hours
 * (normal case for a camp announcement), Meta requires an approved message
 * TEMPLATE, not free-form text. Create the template in Meta Business Manager
 * first (WHATSAPP_TEMPLATE_NAME in .env), with body variables matching the
 * `params` array below.
 */
async function sendViaCloudAPI({ phone, params }) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "camp_announcement";
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en";

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN missing in .env — cannot send via cloud_api mode."
    );
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: params.map((p) => ({ type: "text", text: String(p) })),
        },
      ],
    },
  };

  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });

  return res.data;
}

/**
 * Bulk sender: loops through recipients with a small delay between each call
 * to stay well under Meta's rate limits. Returns per-patient status so the
 * frontend can show a report (sent / failed) instead of a blind "done".
 */
async function bulkSend(recipients, buildParams) {
  const results = [];
  for (const r of recipients) {
    try {
      const params = buildParams(r);
      await sendViaCloudAPI({ phone: r.phone, params });
      results.push({ ...r, status: "sent" });
    } catch (err) {
      results.push({
        ...r,
        status: "failed",
        error: err.response?.data?.error?.message || err.message,
      });
    }
    // small delay to avoid hitting Meta's per-second rate limit on free tier
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return results;
}

module.exports = { sendViaCloudAPI, bulkSend };
