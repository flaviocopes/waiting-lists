import type { APIRoute } from 'astro';
import { destroySession, getSession, hashAdminPassword, verifyAdminCredentials, verifyCsrf } from '../../../lib/auth';
import { getGlobalSettings, updateAdminCredentials, updateNotificationSettings } from '../../../lib/db';
import { getBindings } from '../../../lib/runtime';
import { parseAdminPassword, parseAdminUsername, parseEmail } from '../../../lib/validation';

export const prerender = false;

function settingsUrl(request: Request, result: string) {
	return new URL(`/admin/settings?${result}`, request.url);
}

export const POST: APIRoute = async ({ request }) => {
	const bindings = getBindings();
	const session = await getSession(bindings.DB, request, bindings.SESSION_SECRET);
	if (!session) return Response.redirect(new URL('/login', request.url), 303);
	if (!(await verifyCsrf(request.clone(), session.csrfToken))) return new Response('Forbidden', { status: 403 });

	const form = await request.formData();
	const action = form.get('action');

	if (action === 'notifications') {
		const adminEmail = parseEmail(form.get('admin_email'));
		if (!adminEmail) return Response.redirect(settingsUrl(request, 'notification_error=invalid'), 303);
		await updateNotificationSettings(bindings.DB, {
			adminEmail,
			notifyOnJoin: form.get('notify_on_join') === 'on',
		});
		return Response.redirect(settingsUrl(request, 'notifications_updated=1'), 303);
	}

	if (action === 'credentials') {
		const settings = await getGlobalSettings(bindings.DB);
		if (!settings) return new Response('Global settings are unavailable', { status: 500 });

		const username = parseAdminUsername(form.get('username'));
		const currentPassword = String(form.get('current_password') ?? '').slice(0, 300);
		const newPasswordValue = String(form.get('new_password') ?? '');
		const confirmPassword = String(form.get('confirm_password') ?? '');
		const newPassword = newPasswordValue ? parseAdminPassword(newPasswordValue) : undefined;
		if (!username || !currentPassword || (newPasswordValue && !newPassword)) {
			return Response.redirect(settingsUrl(request, 'credentials_error=invalid'), 303);
		}
		if (newPasswordValue !== confirmPassword) {
			return Response.redirect(settingsUrl(request, 'credentials_error=mismatch'), 303);
		}
		if (!(await verifyAdminCredentials(bindings, settings.admin_username, currentPassword))) {
			return Response.redirect(settingsUrl(request, 'credentials_error=current'), 303);
		}

		const credentialsChanged = username !== settings.admin_username || Boolean(newPassword);
		if (!credentialsChanged) return Response.redirect(settingsUrl(request, 'credentials_updated=1'), 303);
		await updateAdminCredentials(bindings.DB, {
			username,
			passwordHash: newPassword ? await hashAdminPassword(newPassword) : undefined,
		});
		await bindings.DB.prepare('DELETE FROM admin_sessions').run();
		const cookie = await destroySession(bindings.DB, request, bindings.SESSION_SECRET);
		return new Response(null, {
			status: 303,
			headers: { Location: '/login?credentials_updated=1', 'Set-Cookie': cookie },
		});
	}

	return new Response('Invalid settings action', { status: 400 });
};
