<script lang="ts">
  import { Banana, Zap, Gauge, Droplet, ChevronDown, RotateCcw, User, Ruler, Scale, Wheat } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { linear, cubicOut } from 'svelte/easing';
  import { fly, slide } from 'svelte/transition';
  import { onMount } from 'svelte';

  // Piecewise linear carb oxidation by IF (Jeukendrup 2004 / ACSM guidelines)
  function carbsFromIF(if_val: number): number {
    if (if_val <= 0)    return 0;
    if (if_val < 0.55)  return Math.round((if_val / 0.55) * 20);            // 0–20 g/h
    if (if_val < 0.75)  return Math.round(20 + (if_val - 0.55) / 0.20 * 20); // 20–40 g/h
    if (if_val < 0.90)  return Math.round(40 + (if_val - 0.75) / 0.15 * 20); // 40–60 g/h
    if (if_val < 1.05)  return Math.round(60 + (if_val - 0.90) / 0.15 * 30); // 60–90 g/h
    return Math.min(120, Math.round(90 + (if_val - 1.05) / 0.15 * 30));      // 90–120 g/h
  }

  const CARB_RANGES = {
    low:      { min: 30,  max: 45  },
    moderate: { min: 45,  max: 60  },
    high:     { min: 60,  max: 90  },
    extreme:  { min: 90,  max: 120 }
  } as const;

  const FLUID_RANGES = {
    low:      { min: 0.4, max: 0.5 },
    moderate: { min: 0.5, max: 0.7 },
    high:     { min: 0.7, max: 1.0 },
    extreme:  { min: 1.0, max: 1.2 }
  } as const;

  // Per-ride inputs (reset on Reset)
  let distance = 0;
  let duration = 0;
  let power = 0;
  let temperature = 20; // °C — no heat bonus below 20°C; resets with ride

  // Rider profile (persists via localStorage)
  let weight = 0;
  let ftp = 0;
  let imperial = false;
  let sweatRate: 'light' | 'moderate' | 'heavy' = 'moderate';

  // UI state
  let howItWorksOpen = false;
  let profileOpen = false;
  let showGuide = false;
  let profileLoaded = false;

  // Restore profile from localStorage
  onMount(() => {
    try {
      const p = JSON.parse(localStorage.getItem('bs-profile') || '{}');
      if (p.weight > 0) weight = p.weight;
      if (p.ftp > 0) ftp = p.ftp;
      if (typeof p.imperial === 'boolean') imperial = p.imperial;
      if (p.sweatRate) sweatRate = p.sweatRate;
    } catch {
      // ignore parse errors
    }
    profileLoaded = true;
  });
  // Guard: only save after profile has been loaded from storage
  $: if (profileLoaded) localStorage?.setItem('bs-profile', JSON.stringify({ weight, ftp, imperial, sweatRate }));

  // Reset per-ride inputs only; profile persists
  function resetInputs() {
    distance = 0; duration = 0; power = 0; temperature = 20;
    triggerBananaSpin();
  }

  // Imperial ↔ metric: convert displayed values on toggle
  function toggleImperial() {
    if (!imperial) {
      if (weight > 0)   weight   = Math.round(weight * 2.20462);
      if (distance > 0) distance = Math.round(distance * 0.621371 * 10) / 10;
    } else {
      if (weight > 0)   weight   = Math.round(weight / 2.20462);
      if (distance > 0) distance = Math.round(distance * 1.60934);
    }
    imperial = !imperial;
  }

  // Metric-normalised values used in all calculations
  $: weightKg   = imperial ? weight / 2.20462 : weight;
  $: distanceKm = imperial ? distance * 1.60934 : distance;
  $: speedKmh   = distanceKm > 0 && duration > 0 ? distanceKm / duration : 0;
  $: speedUnit  = imperial ? 'mph' : 'km/h';
  $: heatBonus  = temperature > 20 ? Math.round((temperature - 20) / 5 * 0.3 * 10) / 10 : 0;
  $: sweatMultiplier = sweatRate === 'light' ? 0.8 : sweatRate === 'heavy' ? 1.3 : 1.0;

  // Banana spin on input change
  let bananaClass = 'banana-idle';
  let bananaTimer: ReturnType<typeof setTimeout>;
  function triggerBananaSpin() {
    clearTimeout(bananaTimer);
    bananaClass = 'banana-spin';
    bananaTimer = setTimeout(() => { bananaClass = 'banana-idle'; }, 500);
  }

  // Power-derived zone
  $: intensityFactor = ftp > 0 && power > 0 ? power / ftp : 0;
  $: powerDerived = intensityFactor > 0;

  $: bananaColor = intensityFactor < 0.55 ? '#FFD700' :  // yellow
    intensityFactor < 0.75 ? '#F59E0B' :                 // amber
    intensityFactor < 0.90 ? '#F97316' :                 // orange
    intensityFactor < 1.05 ? '#EF4444' :                 // red
    '#DC2626';                                            // deep red

  $: zoneLabel = intensityFactor === 0 ? '' :
    intensityFactor < 0.55 ? 'Recovery' :
    intensityFactor < 0.75 ? 'Endurance' :
    intensityFactor < 0.90 ? 'Tempo' :
    intensityFactor < 1.05 ? 'Threshold' :
    'VO₂max+';

  $: zoneBadgeStyle = intensityFactor === 0 ? '' :
    `background:${
      intensityFactor < 0.55 ? '#4b4b4d' :
      intensityFactor < 0.75 ? '#1151ff' :
      intensityFactor < 0.90 ? '#007d48' :
      intensityFactor < 1.05 ? '#c2410c' : '#d30005'
    };color:#ffffff;transition:background 0.35s ease,color 0.35s ease`;

  $: intensity = (intensityFactor === 0 ? 'moderate' :
    intensityFactor < 0.65 ? 'low' :
    intensityFactor <= 0.80 ? 'moderate' :
    intensityFactor < 0.95 ? 'high' :
    'extreme') as keyof typeof CARB_RANGES;

  // Fluid: weight-scaled + sweat rate + heat adjustment
  $: baseFluid = (FLUID_RANGES[intensity].min + FLUID_RANGES[intensity].max) / 2;
  $: fluidPerHour = weight > 0 && duration > 0 ? baseFluid * (weightKg / 70) * sweatMultiplier + heatBonus : 0;

  // Carbs: IF-based piecewise when power available, zone midpoint fallback
  $: carbsPerHour = duration <= 0 || weight <= 0 ? 0 :
    powerDerived
      ? carbsFromIF(intensityFactor)
      : Math.round((CARB_RANGES[intensity].min + CARB_RANGES[intensity].max) / 2);

  // Energy: kJ mechanical ≈ kcal (cycling standard: 1W × 1h = 3.6 kJ ≈ 3.6 kcal)
  $: kcalPerHour = powerDerived ? Math.round(power * 3.6) : 0;

  // Speed (display unit depends on imperial; animal thresholds always km/h)
  $: speedDisplay = Math.round(imperial ? speedKmh * 0.621371 : speedKmh);

  // Totals
  $: totalCarbs = Math.round(carbsPerHour * duration);
  $: totalFluid = fluidPerHour * duration;
  $: totalKcal  = Math.round(kcalPerHour * duration);

  // Animations
  const TWEEN = { duration: 400, easing: linear };
  const animatedCarbs       = tweened(carbsPerHour, TWEEN);
  const animatedFluid       = tweened(fluidPerHour, TWEEN);
  const animatedSpeed       = tweened(speedDisplay,  TWEEN);
  const animatedTotalCarbs  = tweened(totalCarbs,    TWEEN);
  const animatedTotalFluid  = tweened(totalFluid,    TWEEN);
  const animatedTotalKcal   = tweened(totalKcal,     TWEEN);
  const animatedKcalPerHour = tweened(kcalPerHour,   TWEEN);

  $: animatedCarbs.set(carbsPerHour);
  $: animatedFluid.set(fluidPerHour);
  $: animatedSpeed.set(speedDisplay);
  $: animatedTotalCarbs.set(totalCarbs);
  $: animatedTotalFluid.set(totalFluid);
  $: animatedTotalKcal.set(totalKcal);
  $: animatedKcalPerHour.set(kcalPerHour);

  const animalLinks: Record<string, string> = {
    'Turtle pace':      'https://en.wikipedia.org/wiki/Turtle',
    'Penguin cruise':   'https://en.wikipedia.org/wiki/Penguin',
    'Gazelle pace':     'https://en.wikipedia.org/wiki/Gazelle',
    'Cheetah chase':    'https://en.wikipedia.org/wiki/Cheetah',
    'Falcon flight':    'https://en.wikipedia.org/wiki/Falcon',
    'Peregrine speed':  'https://en.wikipedia.org/wiki/Peregrine_falcon',
    'Greyhound sprint': 'https://en.wikipedia.org/wiki/Greyhound'
  };

  $: speedSlogan = speedKmh === 0 ? '' :
    speedKmh < 10 ? 'Turtle pace' :
    speedKmh < 15 ? 'Penguin cruise' :
    speedKmh < 20 ? 'Gazelle pace' :
    speedKmh < 25 ? 'Cheetah chase' :
    speedKmh < 30 ? 'Falcon flight' :
    speedKmh < 40 ? 'Peregrine speed' :
    'Greyhound sprint';

  $: multiCarbNote = intensityFactor >= 0.90;
  $: sweatRateLabel = sweatRate[0].toUpperCase() + sweatRate.slice(1);

  let howItWorksEl: HTMLElement;

  function toggleHowItWorks() {
    howItWorksOpen = !howItWorksOpen;
    if (howItWorksOpen) {
      setTimeout(() => {
        howItWorksEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 280);
    }
  }
</script>

<main class="min-h-screen bg-[--color-canvas]">
  <div class="max-w-6xl mx-auto p-sm md:p-md lg:p-lg" class:pb-28={duration > 0 && weight > 0}>

    <!-- Title -->
    <div class="text-center mb-section card-enter card-enter-1">
      <div class="flex items-center justify-center gap-md mb-sm">
        <Banana class="w-10 h-10 md:w-12 md:h-12 {bananaClass}" style="color:{bananaColor};transition:color 0.6s ease;" />
        <h1 class="text-heading-xl md:text-display-campaign text-[--color-ink] font-heavy">
          BananaSprocket
        </h1>
      </div>
      <p class="text-caption-md text-[--color-mute] mb-xs">Precise carb & fluid targets from your FTP and ride data.</p>
      {#if weight > 0 || ftp > 0}
        <button class="text-caption-sm text-[--color-stone]" style="text-decoration:underline;text-underline-offset:3px;" on:click={() => (showGuide = !showGuide)}>
          {showGuide ? 'Hide guide' : 'Getting started'}
        </button>
      {/if}
    </div>

    <!-- 3-step how-to — shown on first visit or on demand -->
    {#if profileLoaded && (!(weight > 0 || ftp > 0) || showGuide)}
    <div transition:slide={{ duration: 260, easing: cubicOut }} class="card-soft rounded-sm p-lg md:p-xl mb-section card-enter card-enter-2">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-lg relative">
        <div class="hidden md:block absolute left-0 right-0 top-6 h-px" style="background:var(--color-hairline);"></div>

        <div class="space-y-sm relative z-10">
          <div class="w-8 h-8 rounded-full flex items-center justify-center mb-sm" style="background:rgba(17,81,255,0.1);border:1px solid rgba(17,81,255,0.3);">
            <span class="text-lg font-bold text-[--color-info]">1</span>
          </div>
          <h2 class="text-body-strong font-bold text-[--color-ink]">Set up your profile</h2>
          <p class="text-caption-md text-[--color-charcoal]">Enter weight, FTP, and your preferences once — they save automatically.</p>
        </div>

        <div class="space-y-sm relative z-10">
          <div class="w-8 h-8 rounded-full flex items-center justify-center mb-sm" style="background:rgba(17,81,255,0.1);border:1px solid rgba(17,81,255,0.3);">
            <span class="text-lg font-bold text-[--color-info]">2</span>
          </div>
          <h2 class="text-body-strong font-bold text-[--color-ink]">Enter your ride</h2>
          <p class="text-caption-md text-[--color-charcoal]">Add distance, duration, and planned power for this specific ride.</p>
        </div>

        <div class="space-y-sm relative z-10">
          <div class="w-8 h-8 rounded-full flex items-center justify-center mb-sm" style="background:rgba(17,81,255,0.1);border:1px solid rgba(17,81,255,0.3);">
            <span class="text-lg font-bold text-[--color-info]">3</span>
          </div>
          <h2 class="text-body-strong font-bold text-[--color-ink]">Read results</h2>
          <p class="text-caption-md text-[--color-charcoal]">Get precise carbohydrate and fluid targets based on your power output.</p>
        </div>
      </div>
    </div>
    {/if}

    <!-- Rider Profile -->
    <div class="card-soft rounded-sm mb-section card-enter card-enter-3" on:input={triggerBananaSpin}>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer"
        on:click={() => (profileOpen = !profileOpen)}
        aria-expanded={profileOpen}
      >
        <div class="flex flex-wrap items-center gap-sm min-w-0">
          <div class="flex items-center gap-sm flex-shrink-0">
            <User class="w-5 h-5 text-[--color-ink]" />
            <span class="text-heading-md font-bold text-[--color-ink]">Rider Profile</span>
          </div>
          {#if !profileOpen}
            {#if weight > 0 || ftp > 0}
              <div class="flex flex-wrap gap-xs">
                {#if weight > 0}<span class="badge">{weight} {imperial ? 'lbs' : 'kg'}</span>{/if}
                {#if ftp > 0}<span class="badge">{ftp} W FTP</span>{/if}
                <span class="badge">{imperial ? 'Imperial' : 'Metric'}</span>
                <span class="badge">{sweatRateLabel} sweater</span>
              </div>
            {:else}
              <span class="text-caption-sm text-[--color-sale]">Set up profile for accurate results →</span>
            {/if}
          {/if}
        </div>
        <ChevronDown class="w-5 h-5 text-[--color-ink] transition-transform duration-200 flex-shrink-0 ml-sm {profileOpen ? 'rotate-180' : ''}" />
      </button>

      {#if profileOpen}
        <div transition:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;">
          <div class="bg-[--color-canvas] rounded-sm overflow-hidden"
            style="border:1px solid #e5e5e5;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

            <!-- Weight -->
            <div class="flex items-center justify-between px-lg py-lg">
              <div class="flex items-center gap-sm">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Scale class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <label for="weight" class="text-caption-md text-[--color-ink]">Body Weight</label>
              </div>
              <div class="flex items-center gap-xs">
                <input id="weight" type="number" bind:value={weight} min="1" max="400" step="1" placeholder="75"
                  class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                  style="height:36px;border-radius:20px;border:1px solid #cacacb;padding:0 12px;background:#fff;"
                  on:focus={(e) => (e.target as HTMLInputElement).select()} />
                <span class="text-caption-sm text-[--color-mute] w-8">{imperial ? 'lbs' : 'kg'}</span>
              </div>
            </div>

            <!-- FTP -->
            <div class="flex items-center justify-between px-lg py-lg">
              <div class="flex items-center gap-sm">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Zap class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <div>
                  <label for="ftp" class="text-caption-md text-[--color-ink] block">FTP</label>
                  <span class="text-caption-sm text-[--color-mute]">Max 1-hour power</span>
                </div>
              </div>
              <div class="flex items-center gap-xs">
                <input id="ftp" type="number" bind:value={ftp} min="0" max="600" step="1" placeholder="280"
                  class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                  style="height:36px;border-radius:20px;border:1px solid #cacacb;padding:0 12px;background:#fff;"
                  on:focus={(e) => (e.target as HTMLInputElement).select()} />
                <span class="text-caption-sm text-[--color-mute] w-8">W</span>
              </div>
            </div>

            <!-- Units — segmented control -->
            <div class="flex items-center justify-between px-lg py-lg gap-md flex-wrap">
              <div class="flex items-center gap-sm">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Ruler class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <span class="text-caption-md text-[--color-ink]">Units</span>
              </div>
              <div style="display:flex;border-radius:20px;border:1px solid #cacacb;overflow:hidden;background:#f5f5f5;">
                <button
                  style="{!imperial ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                  on:click={() => { if (imperial) toggleImperial(); }}>km / kg</button>
                <button
                  style="{imperial ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                  on:click={() => { if (!imperial) toggleImperial(); }}>mi / lbs</button>
              </div>
            </div>

            <!-- Sweat Rate — segmented control -->
            <div class="flex items-center justify-between px-lg py-lg gap-md flex-wrap">
              <div class="flex items-center gap-sm">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Droplet class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <div>
                  <span class="text-caption-md text-[--color-ink] block">Sweat Rate</span>
                  <span class="text-caption-sm text-[--color-mute]">
                    {sweatRate === 'light' ? '−20% fluid' : sweatRate === 'heavy' ? '+30% fluid' : 'Baseline'}
                  </span>
                </div>
              </div>
              <div style="display:flex;border-radius:20px;border:1px solid #cacacb;overflow:hidden;background:#f5f5f5;">
                <button
                  style="{sweatRate === 'light' ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;"
                  on:click={() => (sweatRate = 'light')}>Light</button>
                <button
                  style="{sweatRate === 'moderate' ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;"
                  on:click={() => (sweatRate = 'moderate')}>Moderate</button>
                <button
                  style="{sweatRate === 'heavy' ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;"
                  on:click={() => (sweatRate = 'heavy')}>Heavy</button>
              </div>
            </div>

          </div>
        </div>
      {/if}
    </div>

    <!-- Ride Input Card -->
    <div class="bg-[--color-canvas] border border-[var(--color-hairline)] rounded-sm p-lg md:p-xl mb-section card-enter card-enter-4" on:input={triggerBananaSpin}>

      <!-- Row 1: Distance / Duration -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <div class="space-y-sm">
          <label for="distance" class="text-caption-md text-[--color-ink]">Distance</label>
          <div class="flex items-center gap-sm">
            <input id="distance" type="number" bind:value={distance} min="1" max="500" step="1" class="search-pill flex-1" />
            <span class="text-caption-sm text-[--color-mute] whitespace-nowrap">{imperial ? 'mi' : 'km'}</span>
          </div>
        </div>
        <div class="space-y-sm">
          <label for="duration" class="text-caption-md text-[--color-ink]">Duration</label>
          <div class="flex items-center gap-sm">
            <input id="duration" type="number" bind:value={duration} min="0.5" max="24" step="0.5" class="search-pill flex-1" />
            <span class="text-caption-sm text-[--color-mute] whitespace-nowrap">h</span>
          </div>
        </div>
      </div>

      <!-- Row 2: Power / Zone -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-lg mt-lg">
        <div class="space-y-sm">
          <label for="power" class="text-caption-md text-[--color-ink]">Ride Power</label>
          <div class="flex items-center gap-sm">
            <input id="power" type="number" bind:value={power} min="0" max="600" step="1" class="search-pill flex-1" />
            <span class="text-caption-sm text-[--color-mute] whitespace-nowrap">W</span>
          </div>
          <p class="text-caption-sm text-[--color-mute]">Planned average power for this ride</p>
        </div>
        <div class="space-y-sm">
          <span class="text-caption-md text-[--color-ink] block">Zone</span>
          <div class="flex items-center h-10">
            {#if powerDerived && zoneLabel}
              <span class="badge-black" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}%</span>
            {:else if ftp === 0}
              <span class="text-[--color-mute] text-caption-sm">Set FTP in Rider Profile ↑</span>
            {:else}
              <span class="text-[--color-mute] text-caption-sm">Enter ride power</span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Temperature -->
      <div class="mt-lg pt-lg border-t border-[var(--color-hairline)]">
        <div class="flex items-center justify-between mb-sm">
          <label for="temperature" class="text-caption-md text-[--color-ink]">Riding Temperature</label>
          <span class="text-caption-md font-bold text-[--color-ink]">{temperature}°C</span>
        </div>
        <input id="temperature" type="range" bind:value={temperature} min="0" max="45" step="1"
          class="temp-slider w-full"
          style="--fill:{(temperature / 45 * 100).toFixed(1)}%" />
        <p class="text-caption-sm mt-xs {heatBonus > 0 ? 'text-[--color-sale]' : 'text-[--color-mute]'}">
          {heatBonus > 0 ? `+${heatBonus.toFixed(1)} L/h heat adjustment applied` : 'Heat adjustment activates above 20°C'}
        </p>
      </div>

      <!-- Reset -->
      <div class="flex justify-end mt-lg">
        <button class="filter-chip flex items-center gap-xs" on:click={resetInputs} aria-label="Reset ride inputs">
          <RotateCcw class="w-4 h-4" />
          Reset ride
        </button>
      </div>
    </div>

    <!-- Results Row 1: Speed + Power -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg mb-section card-enter card-enter-5">

      <!-- Speed card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
            <Gauge class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Speed</h2>
            <p class="text-caption-sm text-[--color-mute]">Average pace for your ride</p>
          </div>
        </div>
        <div class="mb-lg">
          <div class="flex items-baseline gap-sm">
            <span class="text-7xl md:text-8xl font-extra-bold text-[--color-ink]">{Math.round($animatedSpeed)}</span>
            <span class="text-3xl text-[--color-mute]">{speedUnit}</span>
          </div>
        </div>
        {#if speedSlogan}
          <a href={animalLinks[speedSlogan]} target="_blank" rel="noopener noreferrer">
            <span class="badge-black inline-flex items-center gap-xs">
              {speedSlogan}
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </span>
          </a>
        {/if}
      </div>

      <!-- Power card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
            <Zap class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Power</h2>
            <p class="text-caption-sm text-[--color-mute]">Ride intensity based on your FTP</p>
          </div>
        </div>
        <div class="mb-md">
          <div class="flex items-baseline gap-sm">
            <span class="text-7xl md:text-8xl font-extra-bold text-[--color-ink]">{power}</span>
            <span class="text-3xl text-[--color-mute]">W</span>
          </div>
        </div>
        {#if powerDerived}
          <div class="flex items-center gap-sm flex-wrap">
            <span class="badge-black" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}% FTP</span>
            <span class="badge-black" style="background:#c2410c;color:#ffffff;">~{Math.round($animatedKcalPerHour)} kcal/h</span>
          </div>
        {:else}
          <p class="text-caption-sm text-[--color-mute]">Enter FTP in Rider Profile & ride power above</p>
        {/if}
      </div>
    </div>

    <!-- Results Row 2: Carbs + Fluids -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg mb-section card-enter card-enter-6">

      <!-- Carbs card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-success] flex items-center justify-center flex-shrink-0">
            <Wheat class="w-7 h-7 text-[--color-on-primary]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Carbohydrates</h2>
            <p class="text-caption-sm text-[--color-mute]">Per hour for optimal performance</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key carbsPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold text-[--color-ink] num-flash">{Math.round($animatedCarbs)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">g/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">
          {#if powerDerived}
            From {power}W at {Math.round(intensityFactor * 100)}% FTP
          {:else}
            Estimated from intensity level
          {/if}
        </p>
        {#if multiCarbNote}
          <p class="text-caption-sm text-[--color-mute] mt-sm">Requires glucose+fructose blend (2:1). Single carbs max ~60 g/h.</p>
        {/if}
      </div>

      <!-- Fluids card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-info] flex items-center justify-center flex-shrink-0">
            <Droplet class="w-7 h-7 text-[--color-on-primary]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Fluids</h2>
            <p class="text-caption-sm text-[--color-mute]">Per hour for hydration</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key fluidPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold text-[--color-ink] num-flash">{$animatedFluid.toFixed(1)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">L/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">Based on weight, sweat rate, and duration</p>
        {#if sweatRate !== 'moderate'}
          <p class="text-caption-sm text-[--color-mute] mt-xs">{sweatRate === 'light' ? '−20%' : '+30%'} for {sweatRate} sweater</p>
        {/if}
        {#if heatBonus > 0}
          <p class="text-caption-sm text-[--color-sale] mt-xs">+{heatBonus.toFixed(1)} L/h for {temperature}°C heat</p>
        {/if}
      </div>
    </div>

    <!-- Totals - Dark Campaign, always 3 cols -->
    <div class="card-campaign rounded-sm p-lg md:p-xl mb-section card-enter card-enter-7">
      <h2 class="text-heading-lg mb-lg text-[--color-on-primary]">Total needs for {duration} hours</h2>
      <div class="grid grid-cols-3 gap-md">
        <div class="bg-[--color-on-primary] rounded-md p-md text-center">
          <div class="text-4xl md:text-5xl font-extra-bold text-[--color-ink] mb-xs">{Math.round($animatedTotalCarbs)}g</div>
          <div class="text-caption-sm text-[--color-charcoal]">Carbohydrates</div>
        </div>
        <div class="bg-[--color-on-primary] rounded-md p-md text-center">
          <div class="text-4xl md:text-5xl font-extra-bold text-[--color-ink] mb-xs">
            {powerDerived ? Math.round($animatedTotalKcal) : '—'}
          </div>
          <div class="text-caption-sm text-[--color-charcoal]">kcal</div>
        </div>
        <div class="bg-[--color-on-primary] rounded-md p-md text-center">
          <div class="text-4xl md:text-5xl font-extra-bold text-[--color-info] mb-xs">{$animatedTotalFluid.toFixed(1)}L</div>
          <div class="text-caption-sm text-[--color-charcoal]">Fluids</div>
        </div>
      </div>
    </div>

    <!-- How It Works collapsible -->
    <div class="card-soft rounded-sm" bind:this={howItWorksEl}>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer"
        on:click={toggleHowItWorks}
        aria-expanded={howItWorksOpen}
      >
        <span class="text-heading-md font-bold text-[--color-ink]">How It Works</span>
        <ChevronDown class="w-5 h-5 text-[--color-ink] transition-transform duration-200 {howItWorksOpen ? 'rotate-180' : ''}" />
      </button>
      {#if howItWorksOpen}
        <div transition:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;">
          <div class="bg-[--color-canvas] rounded-sm overflow-hidden p-lg"
            style="border:1px solid #e5e5e5;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">

              <div class="card-soft rounded-sm p-lg space-y-md">
                <h3 class="text-body-strong font-bold text-[--color-ink]">Carbohydrate formula</h3>
                <p class="text-body-md text-[--color-charcoal]">Carbs are driven by relative intensity (% of FTP), not absolute watts — two riders at 200W with different FTPs get different recommendations. Based on Jeukendrup / ACSM guidelines:</p>
                <ul class="text-body-md text-[--color-charcoal] space-y-sm list-disc pl-5">
                  <li>Recovery &lt;55% FTP — 0–20 g/h</li>
                  <li>Endurance 55–75% — 20–40 g/h</li>
                  <li>Tempo 75–90% — 40–60 g/h</li>
                  <li>Threshold 90–105% — 60–90 g/h</li>
                  <li>VO₂max+ &gt;105% — 90–120 g/h (requires glucose+fructose 2:1 blend)</li>
                </ul>
              </div>

              <div class="card-soft rounded-sm p-lg space-y-md">
                <h3 class="text-body-strong font-bold text-[--color-ink]">Fluid & FTP guidance</h3>
                <p class="text-body-md text-[--color-charcoal]">Fluid needs scale with body weight — larger athletes sweat more. The sweat rate modifier adjusts targets for light or heavy sweaters. FTP is roughly the max power you can sustain for 1 hour. Rides under 1 hour rarely need exogenous carbs.</p>
              </div>

              <div class="card-soft rounded-sm p-lg space-y-md">
                <h3 class="text-body-strong font-bold text-[--color-ink]">Regular intake</h3>
                <p class="text-body-md text-[--color-charcoal]">Take ~15–25 g of carbohydrates every 15–20 minutes to keep blood sugar stable. Don't wait until you're hungry or thirsty.</p>
              </div>

              <div class="card-soft rounded-sm p-lg space-y-md">
                <h3 class="text-body-strong font-bold text-[--color-ink]">Electrolytes</h3>
                <p class="text-body-md text-[--color-charcoal]">On rides over 2 hours, supplement with electrolytes — sodium, magnesium, potassium. Plain water alone dilutes electrolyte balance on long efforts.</p>
              </div>

            </div>
          </div>
        </div>
      {/if}
    </div>

  </div>

  <!-- Sticky mobile results bar -->
  {#if duration > 0 && weight > 0}
    <div
      transition:fly={{ y: 100, duration: 350 }}
      class="fixed bottom-0 left-0 right-0 z-50 md:hidden px-sm pb-sm"
      style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom));"
    >
      <div class="liquid-glass rounded-sm px-lg py-md">
        <div class="grid grid-cols-3 text-center">
          <div>
            <div class="text-2xl font-extra-bold text-[--color-ink] leading-tight">
              {Math.round($animatedCarbs)}<span class="text-xs font-normal text-[--color-mute] ml-1">g/h</span>
            </div>
            <div class="text-[10px] text-[--color-stone] uppercase tracking-wide mt-1">Carbs</div>
          </div>
          <div class="border-x border-[var(--color-hairline)]">
            <div class="text-2xl font-extra-bold text-[--color-ink] leading-tight">
              {$animatedFluid.toFixed(1)}<span class="text-xs font-normal text-[--color-mute] ml-1">L/h</span>
            </div>
            <div class="text-[10px] text-[--color-stone] uppercase tracking-wide mt-1">Fluids</div>
          </div>
          <div>
            <div class="text-2xl font-extra-bold text-[--color-ink] leading-tight">
              {powerDerived ? Math.round($animatedKcalPerHour) : '—'}<span class="text-xs font-normal text-[--color-mute] ml-1">{powerDerived ? 'kcal/h' : ''}</span>
            </div>
            <div class="text-[10px] text-[--color-stone] uppercase tracking-wide mt-1">Energy</div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
