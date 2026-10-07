import { createSignal } from 'solid-js';

// Bumped whenever events or answers change, so lists can refetch.
const [eventsVersion, setVersion] = createSignal(0);

export { eventsVersion };
export const invalidateEvents = () => setVersion((v) => v + 1);
