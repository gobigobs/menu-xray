/**
 * Second built-in sample page — a realistic saved copy of a public
 * Swiggy-style restaurant listing ("Anbu Biryani House", Salem), with its
 * public JS bundle text.
 *
 * Same rules as the Zomato sample in sample.ts: hand-written demo data
 * modelled on the public structure of a restaurant listing (Swiggy's
 * public `/dapi/` API shapes, React + webpack, no Next.js), labelled
 * SAMPLE everywhere in the UI, never presented as a live Swiggy fetch.
 * Nothing here is scraped from a live page.
 */
import type { JsBundle } from './types'

export const SWIGGY_SAMPLE_URL =
  'https://www.swiggy.com/restaurants/anbu-biryani-house-seelanaickenpatti-salem-987654'

export const SWIGGY_SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Anbu Biryani House, Seelanaickenpatti, Salem | Order Online | Swiggy</title>
<meta name="description" content="Anbu Biryani House in Seelanaickenpatti, Salem. Biryanis, starters, parotta. Order online on Swiggy.">
<link rel="canonical" href="https://www.swiggy.com/restaurants/anbu-biryani-house-seelanaickenpatti-salem-987654">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Anbu Biryani House",
  "servesCuisine": ["Biryani", "South Indian", "Chettinad"],
  "priceRange": "₹",
  "address": { "@type": "PostalAddress", "streetAddress": "Attur Main Road, Seelanaickenpatti", "addressLocality": "Salem", "addressRegion": "Tamil Nadu", "postalCode": "636201" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "1240" },
  "hasMenu": {
    "@type": "Menu",
    "hasMenuSection": [
      { "@type": "MenuSection", "name": "Biryanis", "hasMenuItem": [
        { "@type": "MenuItem", "name": "Chicken Biryani", "description": "Seeraga samba rice, country chicken, brinjal curry, raita.", "offers": { "@type": "Offer", "price": "220", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Mutton Biryani", "description": "Seeraga samba rice, tender mutton, brinjal curry, raita.", "offers": { "@type": "Offer", "price": "320", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Egg Biryani", "description": "Seeraga samba rice, masala egg, onion raita.", "offers": { "@type": "Offer", "price": "150", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Veg Biryani", "description": "Seeraga samba rice, mixed vegetables, kurma, raita.", "offers": { "@type": "Offer", "price": "170", "priceCurrency": "INR" } }
      ]},
      { "@type": "MenuSection", "name": "Starters", "hasMenuItem": [
        { "@type": "MenuItem", "name": "Chicken 65", "description": "Curry-leaf tossed fried chicken, lemon, onion.", "offers": { "@type": "Offer", "price": "180", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Paneer 65", "description": "Chilli paneer cubes, curry leaves, capsicum.", "offers": { "@type": "Offer", "price": "160", "priceCurrency": "INR" } }
      ]},
      { "@type": "MenuSection", "name": "Breads & Curries", "hasMenuItem": [
        { "@type": "MenuItem", "name": "Parotta (2 pc)", "description": "Flaky layered parotta with salna.", "offers": { "@type": "Offer", "price": "80", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Chicken Chettinad", "description": "Pepper-rich Chettinad chicken curry.", "offers": { "@type": "Offer", "price": "210", "priceCurrency": "INR" } }
      ]},
      { "@type": "MenuSection", "name": "Beverages", "hasMenuItem": [
        { "@type": "MenuItem", "name": "Buttermilk", "description": "Spiced curd buttermilk, curry leaves.", "offers": { "@type": "Offer", "price": "40", "priceCurrency": "INR" } },
        { "@type": "MenuItem", "name": "Filter Coffee", "description": "Strong South Indian filter coffee.", "offers": { "@type": "Offer", "price": "30", "priceCurrency": "INR" } }
      ]}
    ]
  }
}
</script>
<script id="__PRELOADED_STATE__" type="application/json">{"restaurant":{"id":987654,"name":"Anbu Biryani House","city":"salem","area":"Seelanaickenpatti","avgRating":4.5,"costForTwo":400}}</script>
</head>
<body data-reactroot="">
<header>
  <nav>
    <a href="/">Home</a>
    <a href="/search">Search</a>
    <a href="/restaurants/anbu-biryani-house-seelanaickenpatti-salem-987654">Anbu Biryani House</a>
    <a href="/restaurants/anbu-biryani-house-seelanaickenpatti-salem-987654/reviews">Reviews</a>
    <a href="/cart">Cart</a>
    <a href="/checkout">Checkout</a>
    <a href="/order-track">Track Order</a>
  </nav>
</header>
<main>
  <h1>Anbu Biryani House</h1>
  <p class="cuisine">Biryani, South Indian, Chettinad · ₹400 for two · 4.5 ★ (1,240 ratings)</p>
  <section class="menu-list">
    <div class="menu-item"><h3>Chicken Biryani</h3><span class="price">₹220</span><p>Seeraga samba rice, country chicken.</p><span class="tag non-veg">Non-veg</span></div>
    <div class="menu-item"><h3>Mutton Biryani</h3><span class="price">₹320</span><p>Seeraga samba rice, tender mutton.</p><span class="tag non-veg">Non-veg</span></div>
    <div class="menu-item"><h3>Paneer 65</h3><span class="price">₹160</span><p>Chilli paneer cubes, curry leaves.</p><span class="tag veg">Veg</span></div>
    <div class="menu-item"><h3>Filter Coffee</h3><span class="price">₹30</span><p>Strong South Indian filter coffee.</p><span class="tag veg">Veg</span></div>
  </section>
</main>
<script src="/static/restaurant-page.9f31c2.js"></script>
<script src="/static/order-flow.71ab90.js"></script>
</body>
</html>`

export const SWIGGY_SAMPLE_BUNDLES: JsBundle[] = [
  {
    name: 'restaurant-page.9f31c2.js',
    url: '/static/restaurant-page.9f31c2.js',
    code: `
"use strict";(self.webpackChunk=self.webpackChunk||[]).push([[931],{
  4102:(e,t,r)=>{
    async function loadMenu(e){const t=await fetch("/dapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=11.6643&lng=78.1460&restaurantId="+e,{headers:{Accept:"application/json"}});if(!t.ok)throw new Error("menu load failed");return t.json()}
    async function listRestaurants(e,t){return (await fetch("/dapi/restaurants/list/v5?lat="+e+"&lng="+t+"&is-seo-homepage-enabled=true")).json()}
    async function searchRestaurants(e){return (await fetch("/dapi/restaurants/search/v3?str="+encodeURIComponent(e)+"&trackingId=undefined")).json()}
    async function loadReviews(e,t){return (await fetch("/dapi/restaurants/"+e+"/reviews?offset="+t+"&sort=NEWEST")).json()}
    async function loadOffers(e){return (await fetch("/dapi/restaurants/"+e+"/offers")).json()}
    e.exports={loadMenu,listRestaurants,searchRestaurants,loadReviews,loadOffers};
  }
}]);`,
  },
  {
    name: 'order-flow.71ab90.js',
    url: '/static/order-flow.71ab90.js',
    code: `
"use strict";(self.webpackChunk=self.webpackChunk||[]).push([[710],{
  5520:(e,t,r)=>{
    async function addToCart(e){return fetch("/dapi/cart",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)}).then(e=>e.json())}
    async function getCart(e){return fetch("/dapi/cart?restaurantId="+e).then(e=>e.json())}
    async function applyCoupon(e){return fetch("/dapi/coupons/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({couponCode:e})}).then(e=>e.json())}
    async function placeOrder(e){return fetch("/dapi/order/place",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)}).then(e=>e.json())}
    async function startCheckout(e){return fetch("/dapi/checkout/initiate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:e})}).then(e=>e.json())}
    async function trackOrder(e){return fetch("/dapi/order/track?order_id="+e).then(e=>e.json())}
    async function submitRating(e,t){return fetch("/dapi/ratings/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({restaurantId:e,rating:t})}).then(e=>e.json())}
    e.exports={addToCart,getCart,applyCoupon,placeOrder,startCheckout,trackOrder,submitRating};
  }
}]);`,
  },
]
