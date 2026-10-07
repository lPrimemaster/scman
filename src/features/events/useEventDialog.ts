import { useSearchParams } from '@solidjs/router';

/** The event detail is addressed by `?event=<id>` so the back button closes it. */
export function useEventDialog() {
	const [params, setParams] = useSearchParams<{ event?: string }>();
	return {
		openId: () => (params.event ? Number(params.event) : undefined),
		open: (id: number) => setParams({ event: String(id) }),
		close: () => setParams({ event: undefined })
	};
}
