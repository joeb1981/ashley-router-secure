
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantIDs = {
  ashley: "asst_k3dHtKqcdXhc07VgEVpJwkfd",
  "Viral S.F. Video Scripts": "asst_5KL56DaiFpm2GT6Ayp6vqLy5",
  "Your Personal Meal Planner": "asst_YNInGDhCWN2F4KZvl29VgApI"
};

exports.config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { message } = await req.json();

    // 1. Create thread
    const thread = await openai.beta.threads.create();

    // 2. Add message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    // 3. Run Ashley
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantIDs.ashley,
    });

    // 4. Poll until complete
    let runStatus;
    do {
      await new Promise((res) => setTimeout(res, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    } while (runStatus.status !== "completed");

    // 5. Get Ashley’s response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const ashleyMessage = messages.data[0].content[0].text.value;

    // 6. Routing logic
    let routedAssistant = null;
    if (/video|script|reels|tiktok/i.test(ashleyMessage)) routedAssistant = assistantIDs["Viral S.F. Video Scripts"];
    if (/food|calories|meal|macros|nutrition/i.test(ashleyMessage)) routedAssistant = assistantIDs["Your Personal Meal Planner"];

    let finalReply = ashleyMessage;

    if (routedAssistant) {
      const routedThread = await openai.beta.threads.create();
      await openai.beta.threads.messages.create(routedThread.id, {
        role: "user",
        content: message,
      });
      const routedRun = await openai.beta.threads.runs.create(routedThread.id, {
        assistant_id: routedAssistant,
      });

      let routedStatus;
      do {
        await new Promise((res) => setTimeout(res, 1500));
        routedStatus = await openai.beta.threads.runs.retrieve(routedThread.id, routedRun.id);
      } while (routedStatus.status !== "completed");

      const routedMessages = await openai.beta.threads.messages.list(routedThread.id);
      const routedReply = routedMessages.data[0].content[0].text.value;

      finalReply = `${ashleyMessage}

➡️ ${routedReply}`;
    }

    return new Response(JSON.stringify({ response: finalReply }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
