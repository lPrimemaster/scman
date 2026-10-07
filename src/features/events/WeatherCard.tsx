import { createResource, For, Show, type Component } from 'solid-js';
import { eventForecast, describeWeather } from '../../lib/weather';
import { formatDayMonth, weekdayShort } from '../../lib/dates';
import { Icon } from '../../components/ui/Icon';

/** Forecast for the event days within the next 16 days; renders nothing otherwise. */
export const WeatherCard: Component<{ location: string; start: string; end: string }> = (props) => {
	const [forecast] = createResource(
		() => [props.location, props.start, props.end] as const,
		([location, start, end]) => eventForecast(location, start, end)
	);

	return (
		<Show when={forecast()}>
			{(f) => (
				<section class='flex flex-col gap-3' aria-label='Previsão do tempo'>
					<h3 class='text-xs font-semibold tracking-wider text-fg-muted uppercase'>Previsão do tempo</h3>
					<ul class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
						<For each={f().days}>
							{(day) => {
								const weather = describeWeather(day.code);
								return (
									<li class='flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5'>
										<Icon name={weather.icon} class='size-6 shrink-0 text-fg-muted' />
										<div class='min-w-0 flex-1'>
											<p class='text-sm font-medium'>
												<span class='capitalize'>{weekdayShort(day.date)}</span>,{' '}
												{formatDayMonth(day.date)}
											</p>
											<p class='text-xs text-fg-muted'>{weather.label}</p>
										</div>
										<div class='text-right'>
											<p class='text-sm font-semibold tabular-nums'>
												{day.max}° <span class='font-normal text-fg-muted'>{day.min}°</span>
											</p>
											<p class='flex items-center justify-end gap-2 text-xs text-fg-muted tabular-nums'>
												<Show when={day.rain !== null}>
													<span
														class='inline-flex items-center gap-0.5'
														title='Probabilidade de chuva'
													>
														<Icon name='droplet' class='size-3' />
														{day.rain}%
													</span>
												</Show>
												<Show when={day.wind !== null}>
													<span class='inline-flex items-center gap-0.5' title='Vento máximo'>
														<Icon name='wind' class='size-3' />
														{day.wind} km/h
													</span>
												</Show>
											</p>
										</div>
									</li>
								);
							}}
						</For>
					</ul>
					<p class='text-xs text-fg-muted'>
						{f().place} · Dados:{' '}
						<a
							href='https://open-meteo.com/'
							target='_blank'
							rel='noopener'
							class='underline underline-offset-2'
						>
							Open-Meteo
						</a>
					</p>
				</section>
			)}
		</Show>
	);
};
