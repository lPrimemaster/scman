import { createSignal, For, Show, type Component } from 'solid-js';
import type { SimilarRace } from '../../lib/types';
import { formatRange } from '../../lib/dates';
import { cx } from '../../components/ui/cx';
import { Icon } from '../../components/ui/Icon';
import { Field, Input } from '../../components/ui/Field';

/** Name input with a dropdown of existing races that look like the one being typed. */
export const RaceNameField: Component<{
	value: string;
	onInput: (value: string) => void;
	suggestions: SimilarRace[];
	onPick: (race: SimilarRace) => void;
}> = (props) => {
	const [focused, setFocused] = createSignal(false);
	// Escape hides the list until the name changes again
	const [dismissed, setDismissed] = createSignal(false);
	const [active, setActive] = createSignal(-1);
	const open = () => focused() && !dismissed() && props.suggestions.length > 0;

	function onKeyDown(e: KeyboardEvent) {
		if (!open()) return;
		const count = props.suggestions.length;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const step = e.key === 'ArrowDown' ? 1 : -1;
			setActive((i) => (i + step + count) % count);
		} else if (e.key === 'Enter' && active() >= 0) {
			e.preventDefault();
			props.onPick(props.suggestions[active()]);
		} else if (e.key === 'Escape') {
			// Close the list, not the dialog around it
			e.stopPropagation();
			setDismissed(true);
		}
	}

	return (
		<Field label='Nome' class='sm:col-span-2'>
			<div class='relative'>
				<Input
					name='name'
					role='combobox'
					autocomplete='off'
					aria-autocomplete='list'
					aria-expanded={open()}
					aria-controls='race-suggestions'
					aria-activedescendant={open() && active() >= 0 ? `race-suggestion-${active()}` : undefined}
					value={props.value}
					onInput={(e) => {
						setDismissed(false);
						setActive(-1);
						props.onInput(e.currentTarget.value);
					}}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					on:keydown={onKeyDown}
					required
				/>
				<Show when={open()}>
					<div class='absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-surface shadow-lg animate-[fade_120ms_ease-out]'>
						<p class='flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-xs font-medium text-warning'>
							<Icon name='flag' class='size-3.5' />
							Esta prova já existe?
						</p>
						<ul id='race-suggestions' role='listbox' aria-label='Provas existentes' class='pb-1.5'>
							<For each={props.suggestions}>
								{(race, i) => (
									<li
										id={`race-suggestion-${i()}`}
										role='option'
										aria-selected={active() === i()}
										class={cx(
											'flex cursor-pointer items-center justify-between gap-3 px-3 py-2',
											active() === i() ? 'bg-surface-2' : 'hover:bg-surface-2'
										)}
										// Keep the input focused so the click is not lost to blur
										onMouseDown={(e) => e.preventDefault()}
										onMouseEnter={() => setActive(i())}
										onClick={() => props.onPick(race)}
									>
										<span class='min-w-0'>
											<span class='block truncate text-sm font-medium text-fg'>{race.name}</span>
											<span class='block truncate text-xs text-fg-muted'>
												{formatRange(race.start, race.end)} · {race.location}
											</span>
										</span>
										<span class='shrink-0 text-xs font-medium text-accent'>Ver</span>
									</li>
								)}
							</For>
						</ul>
					</div>
				</Show>
			</div>
		</Field>
	);
};
