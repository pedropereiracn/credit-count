'use client'

import { useEffect, useRef } from 'react'

/**
 * The progress track from the approved prototype, ported to the live data.
 *
 * It reads as a coaster's elevation profile: the rail climbs toward the next
 * milestone (the next multiple of ten), a cart sits at how far along you are, and a
 * sign at the crest shows the number you are climbing toward. With zero credits the
 * track is flat, a platform at the station, because a first credit is what raises
 * the first hill.
 *
 * When the credit count rises (you logged a ride for a coaster you had not ridden),
 * the fill and the cart animate up to the new position rather than snapping. The
 * previous value is remembered per browser so the climb only plays on an actual gain,
 * not on every page load. Everything here is presentation; the number is the server's.
 */
export function CreditTrack({ credits }: { credits: number }) {
  const host = useRef<HTMLDivElement>(null)
  const previous = useRef<number | null>(null)

  useEffect(() => {
    let prior = previous.current
    if (prior === null) {
      const stored = Number.parseInt(sessionStorage.getItem('cc-credits') ?? '', 10)
      prior = Number.isFinite(stored) ? stored : credits
    }
    try {
      sessionStorage.setItem('cc-credits', String(credits))
    } catch {
      // private mode or blocked storage: the climb just will not replay, which is fine
    }
    const grew = credits > prior
    mountTrack(host.current, credits, grew ? prior : credits)
    previous.current = credits
  }, [credits])

  return (
    <div className="mt-6">
      <div ref={host} className="[&_svg]:h-auto [&_svg]:w-full [&_svg]:overflow-visible" />
      <TrackCap credits={credits} />
    </div>
  )
}

function TrackCap({ credits }: { credits: number }) {
  const next = Math.floor(credits / 10) * 10 + 10
  return (
    <div className="mt-2 flex justify-between gap-3 text-[13px] font-extrabold text-muted-foreground">
      {credits > 0 ? (
        <>
          <span>
            Next stop: <b className="text-foreground">{next}</b>
          </span>
          <span>
            <b className="text-foreground">{next - credits}</b> to go
          </span>
        </>
      ) : (
        <>
          <span>At the station</span>
          <span>Your first credit raises the first hill</span>
        </>
      )}
    </div>
  )
}

/**
 * Draws the track and, when `to` differs from `from`, eases the fill and the cart
 * from the old position to the new one. Ported from the prototype's mountTrack, with
 * the palette bound to the app's CSS variables so it matches light theme exactly.
 */
function mountTrack(el: HTMLDivElement | null, credits: number, fromCredits: number) {
  if (!el) return

  const flat = credits <= 0
  const next = Math.floor(credits / 10) * 10 + 10
  const base = next - 10
  const to = flat ? 0 : Math.min(1, Math.max(0, (credits - base) / 10))
  const from = flat ? 0 : Math.min(1, Math.max(0, (fromCredits - base) / 10))
  const sign = flat ? '1' : String(next)

  const d = flat
    ? 'M10 74 H590'
    : 'M10 80 H100 C 210 80 290 24 430 20 H590'

  el.innerHTML = `
    <svg viewBox="0 0 600 100" aria-hidden="true">
      <line class="cc-ground" x1="10" y1="93" x2="590" y2="93"/>
      <g class="cc-supports"></g>
      ${flat ? '<rect class="cc-platform" x="16" y="77" width="72" height="10" rx="3"/>' : ''}
      <path class="cc-rail-base" d="${d}"/>
      <path class="cc-rail-fill" d="${d}"/>
      <g class="cc-sign">
        <line class="cc-sign-post" x1="0" y1="-2" x2="0" y2="-22"/>
        <rect class="cc-sign-plate" x="-23" y="-52" width="46" height="31" rx="8"/>
        <text class="cc-sign-text" y="-31" text-anchor="middle">${sign}</text>
      </g>
      <g class="cc-cart">
        <rect class="cc-cart-body" x="-15" y="-16" width="30" height="12" rx="4"/>
        <circle class="cc-cart-wheel" cx="-8" cy="-2.5" r="3.4"/>
        <circle class="cc-cart-wheel" cx="8" cy="-2.5" r="3.4"/>
      </g>
    </svg>`

  const svg = el.firstElementChild as SVGSVGElement
  const fill = svg.querySelector('.cc-rail-fill') as SVGPathElement
  const L = fill.getTotalLength()

  const samples: DOMPoint[] = []
  for (let i = 0; i <= 160; i++) samples.push(fill.getPointAtLength((L * i) / 160))
  const yAt = (x: number) => {
    let best = samples[0]
    for (const p of samples) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p
    return best.y
  }

  if (!flat) {
    let s = ''
    for (let x = 128; x <= 560; x += 43) {
      const y = yAt(x)
      if (93 - y > 10) s += `<line class="cc-support" x1="${x}" y1="${(y + 3).toFixed(1)}" x2="${x}" y2="93"/>`
    }
    ;(svg.querySelector('.cc-supports') as SVGGElement).innerHTML = s
  }

  const end = fill.getPointAtLength(L)
  ;(svg.querySelector('.cc-sign') as SVGGElement).setAttribute(
    'transform',
    `translate(${end.x - 14},${end.y})`,
  )

  fill.style.strokeDasharray = String(L)
  const cart = svg.querySelector('.cc-cart') as SVGGElement
  const place = (p: number) => {
    const at = Math.max(0, Math.min(L, p * L))
    const a = fill.getPointAtLength(at)
    const b = fill.getPointAtLength(Math.min(L, at + 2))
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    cart.setAttribute('transform', `translate(${a.x.toFixed(1)},${a.y.toFixed(1)}) rotate(${ang.toFixed(1)})`)
  }

  const cartFrom = flat ? 0.07 : Math.max(from, 0.035)
  const cartTo = flat ? 0.07 : Math.max(to, 0.035)
  fill.style.strokeDashoffset = String(L * (1 - (flat ? 0 : from)))
  place(cartFrom)

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!flat && to !== from && !reduce) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fill.style.strokeDashoffset = String(L * (1 - to))
        const t0 = performance.now()
        const dur = 900
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / dur)
          const e = 1 - Math.pow(1 - p, 3)
          place(cartFrom + (cartTo - cartFrom) * e)
          if (p < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    )
  } else if (!flat) {
    fill.style.strokeDashoffset = String(L * (1 - to))
    place(cartTo)
  }
}
