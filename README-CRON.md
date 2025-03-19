# Product Hunt Scraper - Cron Job Setup

This document explains how to set up the cron job for the Product Hunt Scraper.

## Overview

The auto-scraper now uses a cron job approach instead of client-side intervals. This means:

1. The scraper will run on a schedule regardless of whether the browser is open
2. It focuses on products from the last 24 hours only
3. It's more reliable and efficient

## Setting Up the Cron Job

### On Vercel

If you're hosting on Vercel, you can use Vercel Cron Jobs:

1. Add this to your `vercel.json` file:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-scraper?secret=YOUR_CRON_SECRET",
      "schedule": "*/10 * * * *"
    }
  ]
}

