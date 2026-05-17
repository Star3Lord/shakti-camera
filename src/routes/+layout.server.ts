import type { LayoutServerLoad } from './$types';

/**
 * Expose the logged-in user's display name on `data.userName` for every page
 * and layout. The hooks already populate `locals.userName` from the
 * `bsj_session` cookie, so this is a thin pass-through that lets components
 * read the value via `$page.data.userName` without each page reimplementing
 * the cookie plumbing.
 */
export const load: LayoutServerLoad = ({ locals }) => {
	return {
		userName: locals.userName ?? null,
	};
};
