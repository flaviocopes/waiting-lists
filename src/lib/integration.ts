import type { WaitingList } from './db';

export function waitingListIntegration(origin: string, list: WaitingList) {
	const endpoint = `${origin}/api/subscribe/${list.slug}`;
	return {
		endpoint,
		allowed_origins: list.allowed_origins,
		html: `<form method="post" action="${endpoint}">
  <input type="email" name="email" required />
  <label>
    <input type="checkbox" name="consent" value="yes" required />
    I want updates about this waitlist and agree to the privacy notice.
  </label>
  <button>Join the waitlist</button>
</form>`,
		javascript: `await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, consent: true }),
});`,
	};
}
