/**
 * Built-in sample page — a realistic saved copy of a public Zomato-style
 * restaurant page ("Burger Barn", Salem), with its public JS bundle text.
 *
 * Why it exists: browsers block cross-origin fetches of real Zomato pages
 * (CORS), so a live paste often cannot be read from the browser at all.
 * This sample is a faithful stand-in — same JSON-LD menu, same endpoint
 * shapes, same route structure a real listing has — so the demo works
 * offline, end to end, with zero network. It is labelled SAMPLE everywhere
 * in the UI; it is not presented as a live Zomato fetch.
 *
 * Nothing here is scraped from a live page: it is hand-written demo data
 * modelled on the public structure of a restaurant listing.
 */
import type { JsBundle } from './types'
import {
  SWIGGY_SAMPLE_BUNDLES,
  SWIGGY_SAMPLE_HTML,
  SWIGGY_SAMPLE_URL,
} from './sampleSwiggy.ts'

export type SampleId = 'zomato' | 'swiggy'

export interface SamplePage {
  id: SampleId
  /** Short label for the demo picker. */
  label: string
  url: string
  html: string
  bundles: JsBundle[]
  note: string
}

export const SAMPLE_URL = 'https://www.zomato.com/salem/burger-barn-seelanaickenpatti/order'

export const SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Burger Barn, Seelanaickenpatti, Salem | Order Online | Zomato</title>
<meta name="description" content="Burger Barn in Seelanaickenpatti, Salem. Burgers, fried chicken, shakes. Order online, view menu, photos and reviews.">
<link rel="canonical" href="https://www.zomato.com/salem/burger-barn-seelanaickenpatti/order">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Burger Barn",
  "servesCuisine": ["Burgers", "Fast Food", "American"],
  "priceRange": "₹₹",
  "address": { "@type": "PostalAddress", "streetAddress": "Attur Main Road, Seelanaickenpatti", "addressLocality": "Salem", "addressRegion": "Tamil Nadu", "postalCode": "636201" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.3", "reviewCount": "812" },
  "hasMenu": {
    "@type": "Menu",
    "hasMenuSection": [
      { "@type": "MenuSection", "name": "Smash Burgers", "hasMenuItem": [
        { "@type": "MenuItem", "name": "Classic Smash Burger", "description": "Double smashed patty, cheddar, house sauce, toasted brioche.", "offers": { "@type": "Offer", "price": "199", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Peri Peri Chicken Burger", "description": "Crispy peri peri chicken, slaw, chipotle mayo.", "offers": { "@type": "Offer", "price": "229", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Double Trouble Cheese Burger", "description": "Two patties, double cheese, caramelised onion, pickles.", "offers": { "@type": "Offer", "price": "279", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Paneer Tikka Burger", "description": "Smoky paneer tikka patty, mint mayo, onion rings.", "offers": { "@type": "Offer", "price": "179", "priceCurrency": "INR" } }
      ]},
      { "@type": "MenuSection", "name": "Fried Chicken", "hasMenuItem": [
        { "@type": "MenuItem", "name": "Crispy Fried Chicken - 2 pc", "description": "Buttermilk-brined, 11-spice crust, served hot.", "offers": { "@type": "Offer", "price": "189", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Chicken Popcorn - Regular", "description": "Bite-size crispy chicken popcorn with peri peri dust.", "offers": { "@type": "Offer", "price": "129", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Chicken Wings - 4 pc", "description": "Tossed in BBQ or hot garlic sauce.", "offers": { "@type": "Offer", "price": "199", "priceCurrency": "INR" } }
      ]},
      { "@type": "MenuSection", "name": "Sides & Shakes", "hasMenuItem": [
        { "@type": "MenuItem", "name": "Peri Peri Fries", "description": "Crinkle-cut fries, peri peri seasoning.", "offers": { "@type": "Offer", "price": "99", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Cheesy Loaded Fries", "description": "Fries, cheese sauce, jalapenos, chicken bits.", "offers": { "@type": "Offer", "price": "149", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Oreo Crunch Shake", "description": "Thick vanilla shake blended with Oreo.", "offers": { "@type": "Offer", "price": "159", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Cold Coffee", "description": "Chilled espresso, milk, vanilla ice cream.", "offers": { "@type": "Offer", "price": "119", "priceCurrency": "INR" } }
      ]}
    ]
  }
}
</script>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"resId":18472931,"city":"salem","entityType":"restaurant"}},"buildId":"zx9K2-sample"}</script>
</head>
<body data-reactroot="">
<header>
  <nav>
    <a href="/">Home</a>
    <a href="/salem/restaurants">Salem Restaurants</a>
    <a href="/salem/burger-barn-seelanaickenpatti">Burger Barn</a>
    <a href="/salem/burger-barn-seelanaickenpatti/order">Order Online</a>
    <a href="/salem/burger-barn-seelanaickenpatti/reviews">Reviews</a>
    <a href="/salem/burger-barn-seelanaickenpatti/photos">Photos</a>
    <a href="/salem/burger-barn-seelanaickenpatti/menu">Menu</a>
    <a href="/checkout">Checkout</a>
    <a href="/track-order">Track Order</a>
  </nav>
</header>
<main>
  <h1>Burger Barn</h1>
  <p class="cuisine">Burgers, Fast Food, American · ₹400 for two</p>
  <section class="menu-list">
    <div class="menu-item"><h3>Classic Smash Burger</h3><span class="price">₹199</span><p>Double smashed patty, cheddar, house sauce.</p><span class="tag non-veg">Non-veg</span></div>
    <div class="menu-item"><h3>Peri Peri Chicken Burger</h3><span class="price">₹229</span><p>Crispy peri peri chicken, slaw, chipotle mayo.</p><span class="tag non-veg">Non-veg</span></div>
    <div class="menu-item"><h3>Paneer Tikka Burger</h3><span class="price">₹179</span><p>Smoky paneer tikka patty, mint mayo.</p><span class="tag veg">Veg</span></div>
    <div class="menu-item"><h3>Crispy Fried Chicken - 2 pc</h3><span class="price">₹189</span><p>Buttermilk-brined, 11-spice crust.</p><span class="tag non-veg">Non-veg</span></div>
  </section>
</main>
<script src="/_next/static/chunks/8412-restaurant-page.js"></script>
<script src="/_next/static/chunks/2093-order-flow.js"></script>
<script src="https://maps.googleapis.com/maps/api/js?key=DEMO_KEY_NOT_REAL"></script>
</body>
</html>`

export const SAMPLE_BUNDLES: JsBundle[] = [
  {
    name: '8412-restaurant-page.js',
    url: '/_next/static/chunks/8412-restaurant-page.js',
    code: `
"use strict";(self.webpackChunk=self.webpackChunk||[]).push([[8412],{
  1204:(e,t,r)=>{const n=r(9021),a=r(7710);
    async function loadRestaurantMenu(e){const t=await fetch("/api/v1/restaurants/"+e+"/menu?include=addons&lang=en",{headers:{Accept:"application/json"}});if(!t.ok)throw new Error("menu load failed");return t.json()}
    async function loadRestaurantDetails(e){return (await fetch("/api/v1/restaurants/"+e+"?fields=info,rating,timings")).json()}
    async function loadReviews(e,t){return (await fetch("/api/v1/restaurants/"+e+"/reviews?page="+t+"&sort=latest")).json()}
    async function loadPhotos(e){return (await fetch("/api/v1/restaurants/"+e+"/photos?limit=24")).json()}
    async function searchSuggest(e){return (await fetch("/api/v1/search/suggest?q="+encodeURIComponent(e)+"&city=salem")).json()}
    async function searchRestaurants(e){return (await fetch("/api/v1/search/restaurants?query="+encodeURIComponent(e)+"&lat=11.6643&lon=78.1460")).json()}
    e.exports={loadRestaurantMenu,loadRestaurantDetails,loadReviews,loadPhotos,searchSuggest,searchRestaurants};
  },
  7710:(e,t)=>{e.exports={routes:{home:{path:"/"},restaurant:{path:"/salem/burger-barn-seelanaickenpatti"},order:{path:"/salem/burger-barn-seelanaickenpatti/order"},reviews:{path:"/salem/burger-barn-seelanaickenpatti/reviews"},photos:{path:"/salem/burger-barn-seelanaickenpatti/photos"},menu:{path:"/salem/burger-barn-seelanaickenpatti/menu"}}}}
}]);`,
  },
  {
    name: '2093-order-flow.js',
    url: '/_next/static/chunks/2093-order-flow.js',
    code: `
"use strict";(self.webpackChunk=self.webpackChunk||[]).push([[2093],{
  3340:(e,t,r)=>{
    const api=r(1204);
    async function addToCart(e,t){return fetch("/api/v1/cart/items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({res_id:e,item_id:t,qty:1})}).then(e=>e.json())}
    async function getCart(){return fetch("/api/v1/cart?res_id=18472931").then(e=>e.json())}
    async function applyCoupon(e){return fetch("/api/v1/cart/coupon",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:e})}).then(e=>e.json())}
    async function placeOrder(e){return fetch("/api/v1/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)}).then(e=>e.json())}
    async function startCheckout(e){return fetch("/api/v1/checkout/initiate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:e})}).then(e=>e.json())}
    async function trackOrder(e){return fetch("/api/v1/orders/"+e+"/tracking").then(e=>e.json())}
    async function submitReview(e,t){return fetch("/api/v1/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({res_id:e,rating:t.rating,text:t.text})}).then(e=>e.json())}
    const gqlQuery="query GetRestaurantMenu($resId: Int!) { restaurant(id: $resId) { menu { sections { name items { name price } } } } }";
    async function fetchMenuGraphQL(e){return fetch("/api/graphql",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:gqlQuery,variables:{resId:e},operationName:"GetRestaurantMenu"})}).then(e=>e.json())}
    e.exports={addToCart,getCart,applyCoupon,placeOrder,startCheckout,trackOrder,submitReview,fetchMenuGraphQL};
  }
}]);`,
  },
]

/**
 * The built-in samples, keyed by id. `sampleForUrl` picks one for a pasted
 * URL so the fallback is honest about which demo stands in: a Swiggy URL
 * falls back to the Swiggy-style sample, anything else to the Zomato one.
 * The live-fetch attempt itself is unchanged — this only chooses the
 * labelled stand-in when the browser blocks the real fetch (CORS).
 */
export const SAMPLES: Record<SampleId, SamplePage> = {
  zomato: {
    id: 'zomato',
    label: 'Zomato — Burger Barn',
    url: SAMPLE_URL,
    html: SAMPLE_HTML,
    bundles: SAMPLE_BUNDLES,
    note: 'Realistic Zomato-style listing (Burger Barn, Salem). Works offline.',
  },
  swiggy: {
    id: 'swiggy',
    label: 'Swiggy — Anbu Biryani House',
    url: SWIGGY_SAMPLE_URL,
    html: SWIGGY_SAMPLE_HTML,
    bundles: SWIGGY_SAMPLE_BUNDLES,
    note: 'Realistic Swiggy-style listing (Anbu Biryani House, Salem). Works offline.',
  },
}

export const SAMPLE_IDS: SampleId[] = ['zomato', 'swiggy']

export function sampleForUrl(url: string): SamplePage {
  try {
    const host = new URL(url).host.toLowerCase()
    if (host.includes('swiggy.com')) return SAMPLES.swiggy
  } catch {
    // Not a parseable URL — fall through to the default sample.
  }
  return SAMPLES.zomato
}

/** The 3 demo targets the findings doc promised (sample stands in for live). */
export const DEMO_TARGETS = [
  {
    label: 'Zomato restaurant page',
    url: SAMPLE_URL,
    note: 'Built-in sample — realistic Zomato-style listing (Burger Barn, Salem). Works offline.',
  },
  {
    label: 'Swiggy restaurant listing',
    url: SWIGGY_SAMPLE_URL,
    note: 'Built-in Swiggy-style sample — Anbu Biryani House, Salem (10 dishes, /dapi/ endpoints). Works offline.',
  },
  {
    label: 'Atti Cafe (own site)',
    url: 'https://atticafe.in/menu',
    note: 'Your own public site — paste its real URL and the analyser runs on whatever the browser can fetch.',
  },
]
