# Cup2Eat — Eat your drink

A website concept for [Cup2Eat](https://www.instagram.com/cup2eat/), a Ghaziabad startup that makes edible cups for chai, coffee and ice cream.

It's a static site: plain HTML, CSS and JavaScript, with no build step.

## What's in it

- **A 3D edible cup:** built in code with three.js, with no model file. It has wafer flutes, a debossed CUP2EAT badge and steaming chai.
  - Scrolling plays a Pour → Sip → Eat sequence, ending with bite marks and crumbs.
  - You can switch between Vanilla, Chocolate, Elaichi and Chocolate-rim cups, fill it with chai, coffee or ice cream, and drag it to spin.
- **A fast-cut photo loader** with words that punch in on each cut.
- **Kulhu**, a proposed mascot: a little wafer cup who blinks, waves and talks when you tap him.
- **A wholesale order calculator** for all four products. It opens WhatsApp with the order already filled in.
- **A floating bottom dock** for navigation, with a highlight that follows the section you're in.
- **A maximalist style** in the brand's own colours: maroon `#6b3336`, sage `#e7ebdc`, off-white `#f9faf4`, and the badge's emerald and gold.

## Run it locally

Any static server works. Run this from the repo root:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Deploying

The site sits at the repo root, so any static host can serve it as-is.

On Vercel, use these settings:
- Framework preset: **Other**
- Root directory: **`./`**
- Build command: leave empty
- Output directory: leave empty

## Structure

```
index.html
css/style.css      base layout and type
css/maximal.css    patterns, stickers, mascot, dock, phone polish
js/main.js         scroll choreography, loader, calculator, dock, mascot
js/cup3d.js        the procedural three.js cup
vendor/            three.js 0.160, GSAP 3.12.5, Lenis 1.1.13
assets/            logo, photos, loader frames
```

## Credits

- Brand details, product info and event photos come from Cup2Eat's public Instagram.
- Lifestyle photography is from [Unsplash](https://unsplash.com).
- Kulhu the mascot is an original proposal, not an existing Cup2Eat character.
