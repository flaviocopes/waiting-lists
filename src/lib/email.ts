import type { AppBindings } from './runtime';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

export async function sendConfirmationEmail(
	bindings: AppBindings,
	input: { email: string; listName: string; token: string; subscriberId: string; removalSignature: string },
) {
	const appUrl = bindings.APP_URL.replace(/\/$/, '');
	const confirmUrl = `${appUrl}/confirm?token=${encodeURIComponent(input.token)}`;
	const removeUrl = `${appUrl}/remove?subscriber=${encodeURIComponent(input.subscriberId)}&signature=${encodeURIComponent(input.removalSignature)}`;
	const safeName = escapeHtml(input.listName);
	const safeConfirmUrl = escapeHtml(confirmUrl);
	const safeRemoveUrl = escapeHtml(removeUrl);

	return bindings.EMAIL.send({
		to: input.email,
		from: { email: bindings.EMAIL_FROM, name: 'waitinglists.dev' },
		subject: `Confirm your place on ${input.listName}`,
		html: `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f0e8;color:#16221d;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
<p style="font-weight:700">waitinglists.dev</p>
<div style="background:#fffdf8;border:1px solid #d9d5ce;border-radius:18px;padding:32px">
<h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">Confirm your place.</h1>
<p style="line-height:1.6">Someone asked to add this email address to <strong>${safeName}</strong>. Confirm below to join.</p>
<p style="margin:28px 0"><a href="${safeConfirmUrl}" style="display:inline-block;background:#143c2d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">Review and confirm</a></p>
<p style="font-size:13px;line-height:1.55;color:#506059">This link expires in 24 hours. If you did not make this request, ignore this message or <a href="${safeRemoveUrl}" style="color:#2f7456">remove the request</a>. We will not add you without confirmation.</p>
</div>
<p style="font-size:12px;line-height:1.5;color:#68766f">You received this transactional message because this address was entered on a waitlist form. <a href="${appUrl}/privacy" style="color:#2f7456">Privacy notice</a></p>
</div></body></html>`,
		text: `Confirm your place on ${input.listName}\n\nSomeone asked to add this email address to ${input.listName}. Review and confirm here:\n${confirmUrl}\n\nThis link expires in 24 hours. If you did not make this request, ignore this message or remove the request here:\n${removeUrl}\n\nPrivacy notice: ${appUrl}/privacy`,
	});
}

export async function sendAdminJoinNotification(
	bindings: AppBindings,
	input: { adminEmail: string; subscriberEmail: string; listName: string; listSlug: string },
) {
	const appUrl = bindings.APP_URL.replace(/\/$/, '');
	const listUrl = `${appUrl}/admin/lists/${encodeURIComponent(input.listSlug)}`;
	const safeSubscriberEmail = escapeHtml(input.subscriberEmail);
	const safeListName = escapeHtml(input.listName);
	const safeListUrl = escapeHtml(listUrl);

	return bindings.EMAIL.send({
		to: input.adminEmail,
		from: { email: bindings.EMAIL_FROM, name: 'waitinglists.dev' },
		subject: `New confirmed signup for ${input.listName}`,
		html: `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f0e8;color:#16221d;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
<p style="font-weight:700">waitinglists.dev</p>
<div style="background:#fffdf8;border:1px solid #d9d5ce;border-radius:18px;padding:32px">
<p style="margin:0 0 8px;color:#506059;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Confirmed signup</p>
<h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">Someone joined ${safeListName}.</h1>
<p style="line-height:1.6"><strong>${safeSubscriberEmail}</strong> completed double opt-in and is now a confirmed subscriber.</p>
<p style="margin:28px 0 0"><a href="${safeListUrl}" style="display:inline-block;background:#143c2d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">View waiting list</a></p>
</div>
<p style="font-size:12px;line-height:1.5;color:#68766f">You can turn these notifications off in global settings.</p>
</div></body></html>`,
		text: `New confirmed signup for ${input.listName}\n\n${input.subscriberEmail} completed double opt-in and is now a confirmed subscriber.\n\nView the waiting list: ${listUrl}\n\nYou can turn these notifications off in global settings.`,
	});
}
