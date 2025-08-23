# Vercel + Cloudflare Custom Domain Setup Guide

This guide explains how to set up a custom domain registered in **Cloudflare** for a Vercel app, with **HTTPS** and **root → www redirect** for SEO.  

---

## **1. Add Domain to Vercel**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard).  
2. Select your project.  
3. Navigate to **Settings → Domains**.  
4. Click **Add** and enter your domain (e.g., `namemypet.app`).  
5. Vercel will show DNS records to configure.

---

## **2. Cloudflare DNS Setup**

**Keep Cloudflare as DNS provider (DNS only).**

| Type  | Name | Value                                | Proxy Status |
|-------|------|--------------------------------------|--------------|
| A     | @    | 76.76.21.21                          | DNS only     |
| CNAME | www  | `<vercel-provided-CNAME>`            | DNS only     |

> Note: Replace `<vercel-provided-CNAME>` with the latest recommended value from Vercel (e.g., `aa935a2cf3cf36d7.vercel-dns-017.com`).  

**Steps:**

1. Log in to Cloudflare → **DNS** for your domain.  
2. Add or edit records as above.  
3. Ensure **Proxy Status** is **DNS only (gray cloud)** for both records.  
4. Save changes.  

---

## **3. Set Primary Domain in Vercel**

1. Go back to **Vercel → Project → Settings → Domains**.  
2. Find your `www` subdomain (e.g., `www.namemypet.app`).  
3. Click **… → Set as Primary Domain**.  

> Vercel will automatically redirect root domain (`namemypet.app`) → `www.namemypet.app`.  

---

## **4. Wait for DNS Propagation**

- DNS changes can take **a few minutes to an hour** to propagate globally.  
- During this time, Vercel may show **“DNS Change Recommended”** for the root domain.  
- Once verified, status for both domains should show:  
  - `www.namemypet.app` → **Valid Configuration / Production**  
  - `namemypet.app` → **Valid Configuration / Production** (with redirect)  

---

## **5. Test Your Setup**

1. Open a browser:  
   - `https://namemypet.app` → should redirect automatically to `https://www.namemypet.app`  
   - `https://www.namemypet.app` → should load your Vercel app over HTTPS  
2. Check SSL: Confirm HTTPS is active for both root and www domains.  
3. Confirm redirect: The root domain should permanently redirect (SEO-friendly) to `www`.  

---

## **6. Optional Cloudflare Security Settings**

- SSL/TLS → **Full (strict)**  
- Enable **Always Use HTTPS**  
- Enable **Automatic HTTPS Rewrites**  
- Optional: Enable **DNSSEC** for extra protection  

---

## **7. Notes & Tips**

- **Root → www redirect** is handled automatically by Vercel once you set the primary domain.  
- Cloudflare Page Rules for redirects are **not needed** if DNS is DNS-only (gray cloud).  
- Always use the **latest CNAME value provided by Vercel** for the `www` record.  

---

## **References**

- [Vercel Domains Documentation](https://vercel.com/docs/concepts/projects/domains)  
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)  

---

**Done!** Your Vercel app is now live on your custom domain with HTTPS and SEO-friendly redirects.
