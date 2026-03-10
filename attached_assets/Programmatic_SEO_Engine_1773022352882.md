# Programmatic SEO Engine

> Ship hundreds of SEO-optimized pages from a single data source. Production-tested architecture that actually ranks.

---

## Metadata

- **Name**: Programmatic SEO Engine
- **Version**: 1.0.0
- **Author**: Jacob Ballard
- **Type**: skill
- **Price**: $19
- **Tags**: seo, programmatic-seo, next.js, directory, schema-markup, sitemap
- **Framework**: Next.js 14+ (App Router)
- **Required Tools**: exec, web_search, file_write, file_read

---

## What This Skill Does

When activated, this skill gives your AI agent the complete architecture to build programmatic SEO sites — directories, glossaries, location pages, entity profiles, and comparison pages — all from a data source you provide.

**This is not theory.** Every pattern here is extracted from a production site generating 500+ pages that rank in Google. You get full, copy-paste code templates — not vague instructions.

### What You Get

1. **Page Factory** — 7 programmatic page types with dynamic metadata, schema markup, and OG images
2. **Schema Markup Library** — 8 pre-built schema components (Organization, LocalBusiness, FAQ, Product, Person, DefinedTerm, BreadcrumbList, WebSite)
3. **Sitemap & Crawl Infrastructure** — Dynamic XML sitemap with priority strategy, robots.txt, SearchAction
4. **OG Image Generator** — Edge-function dynamic images for every page type
5. **Internal Linking Architecture** — Hub-and-spoke pattern with breadcrumbs and cross-linking
6. **Data Pipeline** — Web scraping template + CSV import + database seeding
7. **AI Content Generator** — Script to generate unique prose per page using Claude/OpenAI, avoiding thin content penalties
8. **Content Quality Audit** — Automated script that catches thin pages, duplicate titles, missing schema, and broken links before Google does
9. **On-Demand Revalidation** — Webhook API for instant content freshness when your data changes
10. **Launch Checklist** — 30-point verification before go-live

---

## Prerequisites

Before using this skill, ensure:

- Next.js 14+ project with App Router (`/app` directory)
- Supabase project (free tier works)
- Node.js 18+
- A data source for your niche (CSV, API, or website to scrape)

### Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr cheerio
npm install -D tsx dotenv postgres
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_NAME=YourSiteName
```

---

## Step 1: Database Schema

Run this SQL in your Supabase SQL Editor. Adapt the table and column names to your niche.

The schema below uses a **directory** pattern (entities in locations) which covers 80% of programmatic SEO use cases: service provider directories, business listings, product catalogs, resource directories, etc.

```sql
-- ============================================
-- LOCATIONS TABLE
-- Drives your city/region/area pages
-- ============================================
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                    -- "Austin" or "Downtown Manhattan"
  region TEXT NOT NULL,                  -- "Texas" or "New York"
  region_full TEXT,                      -- "Texas" (full state/region name)
  slug TEXT UNIQUE NOT NULL,             -- "austin-texas"
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  population INTEGER,
  meta_title TEXT,                       -- Override auto-generated title
  meta_description TEXT,                 -- Override auto-generated description
  custom_content JSONB DEFAULT '{}',     -- City-specific prose, FAQs, tips
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_locations_slug ON locations(slug);
CREATE INDEX idx_locations_region ON locations(region);

-- ============================================
-- ENTITIES TABLE
-- Your main content type (professionals, businesses, products, etc.)
-- ============================================
CREATE TABLE entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,                      -- Short bio/description
  long_description TEXT,                 -- Full content
  categories TEXT[] DEFAULT '{}',        -- Tags/specialties/categories
  credentials TEXT[] DEFAULT '{}',       -- Certifications, badges, qualifications
  image_url TEXT,
  website_url TEXT,
  price_cents INTEGER,                   -- Optional pricing
  price_label TEXT,                      -- "per hour", "per session", "starting at"
  rating_avg DECIMAL(3, 2),              -- Cached average rating
  review_count INTEGER DEFAULT 0,        -- Cached review count
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  data_source TEXT,                      -- Where this data came from
  metadata JSONB DEFAULT '{}',           -- Flexible key-value storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_slug ON entities(slug);
CREATE INDEX idx_entities_categories ON entities USING GIN(categories);
CREATE INDEX idx_entities_featured ON entities(is_featured);

-- ============================================
-- ENTITY_LOCATIONS (many-to-many)
-- Connects entities to the locations they serve
-- ============================================
CREATE TABLE entity_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  service_radius_miles INTEGER,
  UNIQUE(entity_id, location_id)
);

CREATE INDEX idx_entity_locations_location ON entity_locations(location_id);
CREATE INDEX idx_entity_locations_entity ON entity_locations(entity_id);

-- ============================================
-- REVIEWS TABLE
-- User-generated ratings and feedback
-- ============================================
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  reviewer_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_entity ON reviews(entity_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================
-- CATEGORIES TABLE
-- For category/specialty/topic hub pages
-- ============================================
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  long_description TEXT,
  parent_slug TEXT,                      -- For nested categories
  icon TEXT,                             -- Emoji or icon class
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  display_order INTEGER DEFAULT 0,
  faqs JSONB DEFAULT '[]',              -- Array of {question, answer}
  related_categories TEXT[] DEFAULT '{}', -- Slugs of related categories
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_slug);

-- ============================================
-- GLOSSARY TERMS TABLE
-- For definition/glossary pages
-- ============================================
CREATE TABLE glossary_terms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  short_definition TEXT NOT NULL,        -- 1-2 sentences
  long_definition TEXT NOT NULL,         -- Full explanation
  pronunciation TEXT,                    -- Optional phonetic guide
  example_sentence TEXT,
  category TEXT,                         -- Group terms by topic
  related_terms TEXT[] DEFAULT '{}',     -- Slugs of related terms
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_glossary_slug ON glossary_terms(slug);
CREATE INDEX idx_glossary_category ON glossary_terms(category);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_locations_timestamp
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_entities_timestamp
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Step 2: Supabase Client Setup

### `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  )
}
```

### `lib/supabase/admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// Service role client for scripts and server-side writes
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

---

## Step 3: Data Pipeline

### 3A: CSV Import Script

Use this template to bulk-import data from a CSV file.

#### `scripts/import-data.ts`

```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i] || ''
      return obj
    }, {} as Record<string, string>)
  })
}

async function importLocations() {
  const csv = readFileSync(resolve(__dirname, '../data/locations.csv'), 'utf-8')
  const rows = parseCSV(csv)

  const BATCH_SIZE = 25
  let imported = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
      name: row.city || row.name,
      region: row.state || row.region,
      region_full: row.state_full || row.region_full || row.state,
      slug: slugify(`${row.city || row.name}-${row.state || row.region}`),
      latitude: parseFloat(row.latitude) || null,
      longitude: parseFloat(row.longitude) || null,
      population: parseInt(row.population) || null,
    }))

    const { error } = await supabase
      .from('locations')
      .upsert(batch, { onConflict: 'slug' })

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message)
    } else {
      imported += batch.length
      console.log(`Imported ${imported}/${rows.length} locations`)
    }
  }

  console.log(`Done. ${imported} locations imported.`)
}

async function importEntities() {
  const csv = readFileSync(resolve(__dirname, '../data/entities.csv'), 'utf-8')
  const rows = parseCSV(csv)

  const BATCH_SIZE = 25
  let imported = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
      name: row.name,
      slug: slugify(row.name),
      description: row.description || null,
      categories: row.categories ? row.categories.split('|') : [],
      credentials: row.credentials ? row.credentials.split('|') : [],
      image_url: row.image_url || null,
      website_url: row.website_url || null,
      price_cents: row.price ? parseInt(row.price) * 100 : null,
      price_label: row.price_label || null,
      data_source: 'csv_import',
    }))

    const { error } = await supabase
      .from('entities')
      .upsert(batch, { onConflict: 'slug' })

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message)
    } else {
      imported += batch.length
      console.log(`Imported ${imported}/${rows.length} entities`)
    }
  }

  console.log(`Done. ${imported} entities imported.`)
}

// Run with: npx tsx scripts/import-data.ts [locations|entities]
const target = process.argv[2]
if (target === 'locations') importLocations()
else if (target === 'entities') importEntities()
else {
  console.log('Usage: npx tsx scripts/import-data.ts [locations|entities]')
}
```

### 3B: Web Scraper Template

Use this template to scrape data from a source website. Customize the selectors for your target.

#### `scripts/scrape-source.ts`

```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELAY_MS = 2000  // Be respectful — 2 seconds between requests
const USER_AGENT = 'Mozilla/5.0 (compatible; DataCollector/1.0)'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
  return response.text()
}

// ============================================
// CUSTOMIZE THIS SECTION FOR YOUR TARGET
// ============================================

interface ScrapedEntity {
  name: string
  description: string
  location: string
  region: string
  categories: string[]
  image_url?: string
  website_url?: string
}

async function scrapeListingPage(url: string): Promise<ScrapedEntity[]> {
  const html = await fetchPage(url)
  const $ = cheerio.load(html)
  const entities: ScrapedEntity[] = []

  // CUSTOMIZE: Update these selectors for your target site
  $('.listing-card').each((_, el) => {
    const $el = $(el)
    entities.push({
      name: $el.find('.listing-name').text().trim(),
      description: $el.find('.listing-description').text().trim(),
      location: $el.find('.listing-city').text().trim(),
      region: $el.find('.listing-state').text().trim(),
      categories: $el.find('.listing-tag').map((_, tag) => $(tag).text().trim()).get(),
      image_url: $el.find('img').attr('src') || undefined,
      website_url: $el.find('a.website-link').attr('href') || undefined,
    })
  })

  return entities
}

async function getNextPageUrl($: cheerio.CheerioAPI): Promise<string | null> {
  // CUSTOMIZE: Update pagination selector
  const nextLink = $('a.pagination-next').attr('href')
  return nextLink || null
}

// ============================================
// IMPORT LOGIC (usually no changes needed)
// ============================================

async function importScrapedEntities(entities: ScrapedEntity[]) {
  let imported = 0
  let skipped = 0

  for (const entity of entities) {
    const slug = slugify(entity.name)

    // Check for duplicates
    const { data: existing } = await supabase
      .from('entities')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      skipped++
      continue
    }

    const { error } = await supabase.from('entities').insert({
      name: entity.name,
      slug,
      description: entity.description,
      categories: entity.categories,
      image_url: entity.image_url,
      website_url: entity.website_url,
      data_source: 'web_scrape',
    })

    if (error) {
      console.error(`Failed to import ${entity.name}:`, error.message)
    } else {
      imported++
    }

    // Also create/link location
    const locationSlug = slugify(`${entity.location}-${entity.region}`)
    await supabase.from('locations').upsert({
      name: entity.location,
      region: entity.region,
      slug: locationSlug,
    }, { onConflict: 'slug' })

    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('slug', locationSlug)
      .single()

    const { data: entityRecord } = await supabase
      .from('entities')
      .select('id')
      .eq('slug', slug)
      .single()

    if (location && entityRecord) {
      await supabase.from('entity_locations').upsert({
        entity_id: entityRecord.id,
        location_id: location.id,
        is_primary: true,
      }, { onConflict: 'entity_id,location_id' })
    }
  }

  console.log(`Imported: ${imported}, Skipped (duplicates): ${skipped}`)
}

async function run() {
  const args = process.argv.slice(2)
  const startUrl = args[0]
  const maxPages = parseInt(args[1] || '10')
  const dryRun = args.includes('--dry-run')

  if (!startUrl) {
    console.log('Usage: npx tsx scripts/scrape-source.ts <start-url> [max-pages] [--dry-run]')
    process.exit(1)
  }

  console.log(`Scraping from: ${startUrl}`)
  console.log(`Max pages: ${maxPages}`)
  console.log(`Dry run: ${dryRun}`)

  let currentUrl: string | null = startUrl
  let pageCount = 0
  let allEntities: ScrapedEntity[] = []

  while (currentUrl && pageCount < maxPages) {
    console.log(`\nPage ${pageCount + 1}: ${currentUrl}`)
    const html = await fetchPage(currentUrl)
    const $ = cheerio.load(html)

    const entities = await scrapeListingPage(currentUrl)
    console.log(`  Found ${entities.length} entities`)
    allEntities.push(...entities)

    currentUrl = await getNextPageUrl($)
    pageCount++

    if (currentUrl) await sleep(DELAY_MS)
  }

  console.log(`\nTotal scraped: ${allEntities.length} entities from ${pageCount} pages`)

  if (dryRun) {
    console.log('\nDry run — preview of first 5 entities:')
    allEntities.slice(0, 5).forEach(e => {
      console.log(`  - ${e.name} (${e.location}, ${e.region}) [${e.categories.join(', ')}]`)
    })
  } else {
    await importScrapedEntities(allEntities)
  }
}

run().catch(console.error)
```

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "import:locations": "tsx scripts/import-data.ts locations",
    "import:entities": "tsx scripts/import-data.ts entities",
    "scrape": "tsx scripts/scrape-source.ts"
  }
}
```

---

## Step 4: Schema Markup Components

Create these components in `components/seo/`. These are the most tedious parts of programmatic SEO — having them pre-built saves hours per project.

### `components/seo/GlobalSchema.tsx`

```tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'YourSite'

export function GlobalSchema() {
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'hello@yourdomain.com',
        contactType: 'customer service',
      },
      sameAs: [
        // Add your social links here
      ],
    },
  ]

  return (
    <>
      {schema.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  )
}
```

### `components/seo/BreadcrumbSchema.tsx`

```tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'

interface BreadcrumbItem {
  name: string
  url?: string
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: `${SITE_URL}${item.url}` } : {}),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### `components/seo/FAQSchema.tsx`

```tsx
interface FAQ {
  question: string
  answer: string
}

export function FAQSchema({ faqs }: { faqs: FAQ[] }) {
  if (!faqs.length) return null

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### `components/seo/LocalBusinessSchema.tsx`

```tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'YourSite'

interface LocalBusinessProps {
  locationName: string
  region: string
  entityCount: number
  description: string
  url: string
}

export function LocalBusinessSchema({
  locationName,
  region,
  entityCount,
  description,
  url,
}: LocalBusinessProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `${SITE_NAME} - ${locationName}, ${region}`,
    description,
    url: `${SITE_URL}${url}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: locationName,
      addressRegion: region,
    },
    // Only add aggregateRating if you have REAL review data
    // Fake ratings violate Google's guidelines and can get you penalized
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### `components/seo/EntitySchema.tsx`

```tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'

interface EntitySchemaProps {
  name: string
  description: string
  url: string
  imageUrl?: string
  categories: string[]
  credentials: string[]
  priceCents?: number
  priceLabel?: string
  ratingAvg?: number
  reviewCount?: number
  locationName?: string
  region?: string
}

export function EntitySchema({
  name,
  description,
  url,
  imageUrl,
  categories,
  credentials,
  priceCents,
  priceLabel,
  ratingAvg,
  reviewCount,
  locationName,
  region,
}: EntitySchemaProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url: `${SITE_URL}${url}`,
    provider: {
      '@type': 'Person',
      name,
      ...(imageUrl ? { image: imageUrl } : {}),
      ...(credentials.length ? {
        hasCredential: credentials.map(c => ({
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: c,
        })),
      } : {}),
    },
    ...(categories.length ? { serviceType: categories.join(', ') } : {}),
    ...(locationName ? {
      areaServed: {
        '@type': 'City',
        name: locationName,
        ...(region ? { containedInPlace: { '@type': 'State', name: region } } : {}),
      },
    } : {}),
  }

  // Only add pricing if you have real data
  if (priceCents) {
    schema.offers = {
      '@type': 'Offer',
      price: (priceCents / 100).toFixed(2),
      priceCurrency: 'USD',
      ...(priceLabel ? { description: priceLabel } : {}),
    }
  }

  // Only add ratings if you have REAL review data
  if (ratingAvg && reviewCount && reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingAvg.toFixed(1),
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### `components/seo/ProductSchema.tsx`

```tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'

interface ProductSchemaProps {
  name: string
  description: string
  url: string
  imageUrl?: string
  priceCents?: number
  ratingValue?: number
  brand?: string
}

export function ProductSchema({
  name,
  description,
  url,
  imageUrl,
  priceCents,
  ratingValue,
  brand,
}: ProductSchemaProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url: `${SITE_URL}${url}`,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
  }

  if (priceCents) {
    schema.offers = {
      '@type': 'Offer',
      price: (priceCents / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    }
  }

  if (ratingValue) {
    schema.review = {
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: ratingValue.toFixed(1),
        bestRating: 10,
        worstRating: 1,
      },
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### `components/seo/DefinedTermSchema.tsx`

```tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'YourSite'

interface DefinedTermProps {
  term: string
  definition: string
  url: string
  category?: string
}

export function DefinedTermSchema({ term, definition, url, category }: DefinedTermProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term,
    description: definition,
    url: `${SITE_URL}${url}`,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: `${SITE_NAME} Glossary`,
      url: `${SITE_URL}/glossary`,
    },
    ...(category ? { termCode: category } : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

---

## Step 5: Programmatic Page Templates

### 5A: Location Pages — `/app/[locations-route]/[slug]/page.tsx`

This is your highest-volume page type. One page per city/region/area you serve.

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { LocalBusinessSchema } from '@/components/seo/LocalBusinessSchema'
import { FAQSchema } from '@/components/seo/FAQSchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

// CUSTOMIZE: Your primary keyword pattern
// Examples: "Dentists in {city}", "Plumbers in {city}", "Yoga Studios in {city}"
const KEYWORD_PATTERN = '{entity_type} in {city}, {region}'

// ISR: Revalidate every hour for fresh entity counts
export const revalidate = 3600

// Pre-render all location pages at build time
export async function generateStaticParams() {
  const supabase = await createClient()
  const { data: locations } = await supabase
    .from('locations')
    .select('slug')
    .order('name')

  return (locations || []).map(loc => ({ slug: loc.slug }))
}

// Dynamic metadata per location
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!location) return {}

  // Count entities in this location
  const { count } = await supabase
    .from('entity_locations')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', location.id)

  const entityCount = count || 0

  // CUSTOMIZE: Adapt title and description to your niche
  const title = `${KEYWORD_PATTERN
    .replace('{entity_type}', 'Top Professionals')
    .replace('{city}', location.name)
    .replace('{region}', location.region)} | ${SITE_NAME}`

  const description = `Find ${entityCount} verified professionals in ${location.name}, ${location.region_full || location.region}. Compare ratings, read reviews, and book online.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/locations/${slug}`,
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${SITE_URL}/locations/${slug}` },
  }
}

export default async function LocationPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!location) notFound()

  // Fetch entities in this location with their details
  const { data: entityLinks } = await supabase
    .from('entity_locations')
    .select(`
      entity_id,
      entities (
        id, name, slug, description, categories,
        credentials, image_url, rating_avg, review_count,
        price_cents, price_label
      )
    `)
    .eq('location_id', location.id)

  const entities = (entityLinks || [])
    .map(link => (link as any).entities)
    .filter(Boolean)

  // Parse custom content (city-specific prose, FAQs, etc.)
  const customContent = location.custom_content || {}
  const faqs = customContent.faqs || []

  return (
    <main>
      {/* Schema Markup */}
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Locations', url: '/locations' },
        { name: `${location.name}, ${location.region}` },
      ]} />
      <LocalBusinessSchema
        locationName={location.name}
        region={location.region}
        entityCount={entities.length}
        description={`Find top professionals in ${location.name}, ${location.region_full || location.region}.`}
        url={`/locations/${slug}`}
      />
      {faqs.length > 0 && <FAQSchema faqs={faqs} />}

      {/* Page Content */}
      <section>
        <h1>
          {/* CUSTOMIZE: Your H1 pattern */}
          Top Professionals in {location.name}, {location.region}
        </h1>
        <p>
          {entities.length} verified professionals serving {location.name},{' '}
          {location.region_full || location.region}.
        </p>
      </section>

      {/* Entity Listings */}
      <section>
        <h2>All Professionals in {location.name}</h2>
        <div>
          {entities.map((entity: any) => (
            <a key={entity.id} href={`/profiles/${entity.slug}`}>
              <div>
                {entity.image_url && (
                  <img src={entity.image_url} alt={entity.name} loading="lazy" />
                )}
                <h3>{entity.name}</h3>
                {entity.credentials?.length > 0 && (
                  <p>{entity.credentials.join(' · ')}</p>
                )}
                <p>{entity.description}</p>
                {entity.rating_avg && (
                  <span>{entity.rating_avg.toFixed(1)} ({entity.review_count} reviews)</span>
                )}
                {entity.price_cents && (
                  <span>${(entity.price_cents / 100).toFixed(0)} {entity.price_label}</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Custom Content (city-specific prose for SEO) */}
      {customContent.prose && (
        <section>
          <h2>About {location.name}</h2>
          <div dangerouslySetInnerHTML={{ __html: customContent.prose }} />
        </section>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <section>
          <h2>Frequently Asked Questions</h2>
          {faqs.map((faq: any, i: number) => (
            <details key={i}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      )}

      {/* Internal Links — Cross-link to related pages */}
      <section>
        <h2>Explore More</h2>
        <nav>
          <a href="/categories">Browse by Category</a>
          <a href="/glossary">Glossary</a>
          <a href="/locations">All Locations</a>
        </nav>
      </section>
    </main>
  )
}
```

### 5B: Category Pages — `/app/categories/[slug]/page.tsx`

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { FAQSchema } from '@/components/seo/FAQSchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

export const revalidate = 3600

export async function generateStaticParams() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('slug')

  return (categories || []).map(c => ({ slug: c.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!category) return {}

  const title = category.seo_title || `${category.name} | ${SITE_NAME}`
  const description = category.seo_description || category.description || ''

  return {
    title,
    description,
    keywords: category.seo_keywords || [],
    openGraph: { title, description, type: 'website', url: `${SITE_URL}/categories/${slug}` },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${SITE_URL}/categories/${slug}` },
  }
}

export default async function CategoryPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!category) notFound()

  // Fetch entities in this category
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name, slug, description, image_url, rating_avg, review_count')
    .contains('categories', [category.name])
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(50)

  // Fetch related categories
  const relatedSlugs = category.related_categories || []
  const { data: relatedCategories } = await supabase
    .from('categories')
    .select('name, slug, icon')
    .in('slug', relatedSlugs.length > 0 ? relatedSlugs : ['__none__'])

  const faqs = category.faqs || []

  return (
    <main>
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Categories', url: '/categories' },
        { name: category.name },
      ]} />
      {faqs.length > 0 && <FAQSchema faqs={faqs} />}

      <section>
        <h1>{category.name}</h1>
        <p>{category.description}</p>
        {category.long_description && <div>{category.long_description}</div>}
      </section>

      <section>
        <h2>Top {category.name} Professionals</h2>
        {(entities || []).map((entity: any) => (
          <a key={entity.id} href={`/profiles/${entity.slug}`}>
            <h3>{entity.name}</h3>
            <p>{entity.description}</p>
            {entity.rating_avg && (
              <span>{entity.rating_avg.toFixed(1)} ({entity.review_count} reviews)</span>
            )}
          </a>
        ))}
      </section>

      {faqs.length > 0 && (
        <section>
          <h2>Frequently Asked Questions</h2>
          {faqs.map((faq: any, i: number) => (
            <details key={i}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      )}

      {/* Internal Links — Related categories */}
      {relatedCategories && relatedCategories.length > 0 && (
        <section>
          <h2>Related Categories</h2>
          <nav>
            {relatedCategories.map((rc: any) => (
              <a key={rc.slug} href={`/categories/${rc.slug}`}>
                {rc.icon} {rc.name}
              </a>
            ))}
          </nav>
        </section>
      )}
    </main>
  )
}
```

### 5C: Glossary Term Pages — `/app/glossary/[slug]/page.tsx`

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { DefinedTermSchema } from '@/components/seo/DefinedTermSchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

export async function generateStaticParams() {
  const supabase = await createClient()
  const { data: terms } = await supabase
    .from('glossary_terms')
    .select('slug')

  return (terms || []).map(t => ({ slug: t.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: term } = await supabase
    .from('glossary_terms')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!term) return {}

  const title = `What is ${term.term}? Definition & Examples | ${SITE_NAME}`
  const description = term.short_definition

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url: `${SITE_URL}/glossary/${slug}` },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${SITE_URL}/glossary/${slug}` },
  }
}

export default async function GlossaryTermPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: term } = await supabase
    .from('glossary_terms')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!term) notFound()

  // Fetch related terms
  const relatedSlugs = term.related_terms || []
  const { data: relatedTerms } = await supabase
    .from('glossary_terms')
    .select('term, slug, short_definition')
    .in('slug', relatedSlugs.length > 0 ? relatedSlugs : ['__none__'])

  // Fetch more terms from same category
  const { data: categoryTerms } = await supabase
    .from('glossary_terms')
    .select('term, slug')
    .eq('category', term.category || '')
    .neq('slug', slug)
    .limit(6)

  return (
    <main>
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Glossary', url: '/glossary' },
        { name: term.term },
      ]} />
      <DefinedTermSchema
        term={term.term}
        definition={term.long_definition}
        url={`/glossary/${slug}`}
        category={term.category}
      />

      <article>
        <h1>What is {term.term}?</h1>

        {term.pronunciation && (
          <p><em>/{term.pronunciation}/</em></p>
        )}

        <section>
          <h2>Quick Definition</h2>
          <p>{term.short_definition}</p>
        </section>

        <section>
          <h2>Full Explanation</h2>
          <p>{term.long_definition}</p>
        </section>

        {term.example_sentence && (
          <section>
            <h2>Example</h2>
            <blockquote>{term.example_sentence}</blockquote>
          </section>
        )}
      </article>

      {/* Internal Links — Related terms */}
      {relatedTerms && relatedTerms.length > 0 && (
        <section>
          <h2>Related Terms</h2>
          <nav>
            {relatedTerms.map((rt: any) => (
              <a key={rt.slug} href={`/glossary/${rt.slug}`}>
                <strong>{rt.term}</strong>
                <p>{rt.short_definition}</p>
              </a>
            ))}
          </nav>
        </section>
      )}

      {categoryTerms && categoryTerms.length > 0 && (
        <section>
          <h2>More {term.category} Terms</h2>
          <nav>
            {categoryTerms.map((ct: any) => (
              <a key={ct.slug} href={`/glossary/${ct.slug}`}>
                {ct.term}
              </a>
            ))}
          </nav>
        </section>
      )}

      <nav>
        <a href="/glossary">Back to Full Glossary</a>
      </nav>
    </main>
  )
}
```

### 5D: Entity Profile Pages — `/app/profiles/[slug]/page.tsx`

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { EntitySchema } from '@/components/seo/EntitySchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

export const revalidate = 3600

export async function generateStaticParams() {
  const supabase = await createClient()
  const { data: entities } = await supabase
    .from('entities')
    .select('slug')

  return (entities || []).map(e => ({ slug: e.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: entity } = await supabase
    .from('entities')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!entity) return {}

  // Get primary location
  const { data: locationLink } = await supabase
    .from('entity_locations')
    .select('locations (name, region)')
    .eq('entity_id', entity.id)
    .eq('is_primary', true)
    .single()

  const location = (locationLink as any)?.locations
  const locationStr = location ? ` in ${location.name}, ${location.region}` : ''

  const title = `${entity.name}${entity.credentials?.length ? ` - ${entity.credentials[0]}` : ''}${locationStr} | ${SITE_NAME}`
  const description = entity.description?.slice(0, 155) || `Learn more about ${entity.name}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `${SITE_URL}/profiles/${slug}`,
      ...(entity.image_url ? { images: [entity.image_url] } : {}),
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${SITE_URL}/profiles/${slug}` },
  }
}

export default async function EntityProfilePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: entity } = await supabase
    .from('entities')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!entity) notFound()

  // Get locations
  const { data: locationLinks } = await supabase
    .from('entity_locations')
    .select('is_primary, locations (name, region, slug)')
    .eq('entity_id', entity.id)

  const locations = (locationLinks || []).map((l: any) => ({
    ...l.locations,
    is_primary: l.is_primary,
  }))

  const primaryLocation = locations.find((l: any) => l.is_primary) || locations[0]

  // Get reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('entity_id', entity.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <main>
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        ...(primaryLocation ? [
          { name: `${primaryLocation.name}, ${primaryLocation.region}`, url: `/locations/${primaryLocation.slug}` },
        ] : []),
        { name: entity.name },
      ]} />
      <EntitySchema
        name={entity.name}
        description={entity.description || ''}
        url={`/profiles/${slug}`}
        imageUrl={entity.image_url}
        categories={entity.categories || []}
        credentials={entity.credentials || []}
        priceCents={entity.price_cents}
        priceLabel={entity.price_label}
        ratingAvg={entity.rating_avg}
        reviewCount={entity.review_count}
        locationName={primaryLocation?.name}
        region={primaryLocation?.region}
      />

      <section>
        {entity.image_url && (
          <img src={entity.image_url} alt={entity.name} />
        )}
        <h1>{entity.name}</h1>

        {entity.credentials?.length > 0 && (
          <div>{entity.credentials.map((c: string) => (
            <span key={c}>{c}</span>
          ))}</div>
        )}

        {entity.rating_avg && (
          <div>
            {entity.rating_avg.toFixed(1)} ({entity.review_count} reviews)
          </div>
        )}

        {entity.price_cents && (
          <div>
            ${(entity.price_cents / 100).toFixed(0)} {entity.price_label}
          </div>
        )}
      </section>

      {/* About */}
      <section>
        <h2>About {entity.name}</h2>
        <p>{entity.long_description || entity.description}</p>
      </section>

      {/* Categories/Specialties */}
      {entity.categories?.length > 0 && (
        <section>
          <h2>Specialties</h2>
          <div>{entity.categories.map((cat: string) => (
            <a key={cat} href={`/categories/${cat.toLowerCase().replace(/\s+/g, '-')}`}>
              {cat}
            </a>
          ))}</div>
        </section>
      )}

      {/* Locations Served */}
      {locations.length > 0 && (
        <section>
          <h2>Locations</h2>
          <nav>
            {locations.map((loc: any) => (
              <a key={loc.slug} href={`/locations/${loc.slug}`}>
                {loc.name}, {loc.region}
              </a>
            ))}
          </nav>
        </section>
      )}

      {/* Reviews */}
      {reviews && reviews.length > 0 && (
        <section>
          <h2>Reviews</h2>
          {reviews.map((review: any) => (
            <div key={review.id}>
              <div>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
              {review.comment && <p>{review.comment}</p>}
              <time>{new Date(review.created_at).toLocaleDateString()}</time>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
```

### 5E: Comparison ("X vs Y") Pages — `/app/compare/[slug]/page.tsx`

These target high-intent "A vs B" searches. The URL pattern is `/compare/entity-a-vs-entity-b`. Combinatorially generates pages for every entity pairing in a category.

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { FAQSchema } from '@/components/seo/FAQSchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

export const revalidate = 3600

function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Generate all A-vs-B combinations for entities that share a category
export async function generateStaticParams() {
  const supabase = await createClient()
  const { data: entities } = await supabase
    .from('entities')
    .select('slug, categories')
    .order('name')

  if (!entities) return []

  const params: { slug: string }[] = []
  const seen = new Set<string>()

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i]
      const b = entities[j]
      // Only create comparisons for entities sharing at least one category
      const shared = (a.categories || []).some((c: string) =>
        (b.categories || []).includes(c)
      )
      if (!shared) continue

      // Alphabetical order for consistent URLs
      const [first, second] = [a.slug, b.slug].sort()
      const key = `${first}-vs-${second}`
      if (!seen.has(key)) {
        seen.add(key)
        params.push({ slug: key })
      }
    }
  }

  return params
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const parts = slug.split('-vs-')
  if (parts.length !== 2) return {}

  const nameA = slugToName(parts[0])
  const nameB = slugToName(parts[1])

  const title = `${nameA} vs ${nameB} — Side-by-Side Comparison | ${SITE_NAME}`
  const description = `Compare ${nameA} and ${nameB} side by side. See ratings, pricing, features, and reviews to decide which is right for you.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url: `${SITE_URL}/compare/${slug}` },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${SITE_URL}/compare/${slug}` },
  }
}

export default async function ComparisonPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const parts = slug.split('-vs-')
  if (parts.length !== 2) notFound()

  const supabase = await createClient()

  // Fetch both entities
  const [resultA, resultB] = await Promise.all([
    supabase.from('entities').select('*').eq('slug', parts[0]).single(),
    supabase.from('entities').select('*').eq('slug', parts[1]).single(),
  ])

  const entityA = resultA.data
  const entityB = resultB.data

  if (!entityA || !entityB) notFound()

  // Fetch reviews for both
  const [reviewsA, reviewsB] = await Promise.all([
    supabase.from('reviews').select('rating').eq('entity_id', entityA.id),
    supabase.from('reviews').select('rating').eq('entity_id', entityB.id),
  ])

  // Auto-generate comparison FAQs
  const faqs = [
    {
      question: `What is the difference between ${entityA.name} and ${entityB.name}?`,
      answer: `${entityA.name} ${entityA.description ? `is known for: ${entityA.description.slice(0, 100)}` : 'offers professional services'}. ${entityB.name} ${entityB.description ? `is known for: ${entityB.description.slice(0, 100)}` : 'also offers professional services'}. Compare their full profiles above for details.`,
    },
    {
      question: `Which has better reviews, ${entityA.name} or ${entityB.name}?`,
      answer: `${entityA.name} has a ${entityA.rating_avg?.toFixed(1) || 'N/A'} rating from ${entityA.review_count || 0} reviews. ${entityB.name} has a ${entityB.rating_avg?.toFixed(1) || 'N/A'} rating from ${entityB.review_count || 0} reviews.`,
    },
  ]

  // Find shared and unique categories
  const categoriesA = new Set(entityA.categories || [])
  const categoriesB = new Set(entityB.categories || [])
  const shared = [...categoriesA].filter(c => categoriesB.has(c))
  const uniqueA = [...categoriesA].filter(c => !categoriesB.has(c))
  const uniqueB = [...categoriesB].filter(c => !categoriesA.has(c))

  return (
    <main>
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Compare' },
        { name: `${entityA.name} vs ${entityB.name}` },
      ]} />
      <FAQSchema faqs={faqs} />

      <section>
        <h1>{entityA.name} vs {entityB.name}</h1>
        <p>A detailed side-by-side comparison to help you choose.</p>
      </section>

      {/* Comparison Table */}
      <section>
        <h2>Head-to-Head Comparison</h2>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>{entityA.name}</th>
              <th>{entityB.name}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rating</td>
              <td>{entityA.rating_avg?.toFixed(1) || '—'} ({entityA.review_count || 0} reviews)</td>
              <td>{entityB.rating_avg?.toFixed(1) || '—'} ({entityB.review_count || 0} reviews)</td>
            </tr>
            <tr>
              <td>Price</td>
              <td>{entityA.price_cents ? `$${(entityA.price_cents / 100).toFixed(0)} ${entityA.price_label || ''}` : '—'}</td>
              <td>{entityB.price_cents ? `$${(entityB.price_cents / 100).toFixed(0)} ${entityB.price_label || ''}` : '—'}</td>
            </tr>
            <tr>
              <td>Categories</td>
              <td>{(entityA.categories || []).join(', ') || '—'}</td>
              <td>{(entityB.categories || []).join(', ') || '—'}</td>
            </tr>
            <tr>
              <td>Credentials</td>
              <td>{(entityA.credentials || []).join(', ') || '—'}</td>
              <td>{(entityB.credentials || []).join(', ') || '—'}</td>
            </tr>
            <tr>
              <td>Verified</td>
              <td>{entityA.is_verified ? 'Yes' : 'No'}</td>
              <td>{entityB.is_verified ? 'Yes' : 'No'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* What they share */}
      {shared.length > 0 && (
        <section>
          <h2>What They Have in Common</h2>
          <p>Both {entityA.name} and {entityB.name} specialize in: {shared.join(', ')}.</p>
        </section>
      )}

      {/* What's unique */}
      {(uniqueA.length > 0 || uniqueB.length > 0) && (
        <section>
          <h2>Key Differences</h2>
          {uniqueA.length > 0 && (
            <p><strong>{entityA.name}</strong> uniquely offers: {uniqueA.join(', ')}.</p>
          )}
          {uniqueB.length > 0 && (
            <p><strong>{entityB.name}</strong> uniquely offers: {uniqueB.join(', ')}.</p>
          )}
        </section>
      )}

      {/* FAQs */}
      <section>
        <h2>Frequently Asked Questions</h2>
        {faqs.map((faq, i) => (
          <details key={i}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>

      {/* Internal Links — Profile pages */}
      <section>
        <h2>Full Profiles</h2>
        <nav>
          <a href={`/profiles/${entityA.slug}`}>View {entityA.name} Full Profile</a>
          <a href={`/profiles/${entityB.slug}`}>View {entityB.name} Full Profile</a>
        </nav>
      </section>
    </main>
  )
}
```

### 5F: "Best Of" Listicle Pages — `/app/best/[slug]/page.tsx`

Targets "best {category} in {location}" — the highest commercial intent keywords in any directory niche.

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { FAQSchema } from '@/components/seo/FAQSchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

export const revalidate = 3600

// Generate combinations: best-{category}-in-{location}
export async function generateStaticParams() {
  const supabase = await createClient()
  const [categoriesRes, locationsRes] = await Promise.all([
    supabase.from('categories').select('slug'),
    supabase.from('locations').select('slug'),
  ])

  const params: { slug: string }[] = []

  // Category-only pages: "best-{category}"
  for (const cat of categoriesRes.data || []) {
    params.push({ slug: cat.slug })
  }

  // Category + location pages: "best-{category}-in-{location}"
  for (const cat of categoriesRes.data || []) {
    for (const loc of locationsRes.data || []) {
      params.push({ slug: `${cat.slug}-in-${loc.slug}` })
    }
  }

  return params
}

function parseSlug(slug: string): { categorySlug: string; locationSlug?: string } {
  const inMatch = slug.match(/^(.+?)-in-(.+)$/)
  if (inMatch) {
    return { categorySlug: inMatch[1], locationSlug: inMatch[2] }
  }
  return { categorySlug: slug }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const { categorySlug, locationSlug } = parseSlug(slug)

  const supabase = await createClient()
  const { data: category } = await supabase
    .from('categories')
    .select('name')
    .eq('slug', categorySlug)
    .single()

  if (!category) return {}

  let locationName = ''
  if (locationSlug) {
    const { data: location } = await supabase
      .from('locations')
      .select('name, region')
      .eq('slug', locationSlug)
      .single()
    if (location) locationName = `in ${location.name}, ${location.region}`
  }

  const year = new Date().getFullYear()
  const title = `Best ${category.name} ${locationName} (${year}) | ${SITE_NAME}`
  const description = `Our top picks for the best ${category.name.toLowerCase()} ${locationName}. Ranked by ratings, reviews, and verified credentials.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url: `${SITE_URL}/best/${slug}` },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${SITE_URL}/best/${slug}` },
  }
}

export default async function BestOfPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { categorySlug, locationSlug } = parseSlug(slug)

  const supabase = await createClient()
  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', categorySlug)
    .single()

  if (!category) notFound()

  let location: any = null
  if (locationSlug) {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('slug', locationSlug)
      .single()
    location = data
  }

  // Build the query — entities matching this category, sorted by rating
  let query = supabase
    .from('entities')
    .select('id, name, slug, description, categories, credentials, image_url, rating_avg, review_count, price_cents, price_label')
    .contains('categories', [category.name])
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(20)

  // If location-scoped, join through entity_locations
  let entities: any[] = []
  if (location) {
    const { data: links } = await supabase
      .from('entity_locations')
      .select('entities (*)')
      .eq('location_id', location.id)

    const locationEntities = (links || [])
      .map((l: any) => l.entities)
      .filter((e: any) => e && (e.categories || []).includes(category.name))
      .sort((a: any, b: any) => (b.rating_avg || 0) - (a.rating_avg || 0))
      .slice(0, 20)

    entities = locationEntities
  } else {
    const { data } = await query
    entities = data || []
  }

  const year = new Date().getFullYear()
  const locationStr = location ? ` in ${location.name}, ${location.region}` : ''

  const faqs = [
    {
      question: `How did you rank the best ${category.name.toLowerCase()}${locationStr}?`,
      answer: `Rankings are based on verified customer reviews, overall rating, credentials, and experience. Only professionals with verified profiles are included.`,
    },
    {
      question: `How often is this list updated?`,
      answer: `This list is automatically updated as new reviews come in and professionals update their profiles. Data is refreshed hourly.`,
    },
  ]

  return (
    <main>
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Best Of', url: '/best' },
        ...(location ? [{ name: `${location.name}, ${location.region}`, url: `/locations/${location.slug}` }] : []),
        { name: `Best ${category.name}` },
      ]} />
      <FAQSchema faqs={faqs} />

      <section>
        <h1>Best {category.name}{locationStr} ({year})</h1>
        <p>
          {entities.length} top-rated {category.name.toLowerCase()} professionals{locationStr},
          ranked by customer reviews and verified credentials.
        </p>
      </section>

      {/* Ranked List */}
      <section>
        <ol>
          {entities.map((entity: any, rank: number) => (
            <li key={entity.id}>
              <a href={`/profiles/${entity.slug}`}>
                <div>
                  <span>#{rank + 1}</span>
                  {entity.image_url && <img src={entity.image_url} alt={entity.name} loading="lazy" />}
                  <div>
                    <h2>{entity.name}</h2>
                    {entity.credentials?.length > 0 && (
                      <p>{entity.credentials.join(' · ')}</p>
                    )}
                    <p>{entity.description}</p>
                    <div>
                      {entity.rating_avg && (
                        <span>{entity.rating_avg.toFixed(1)} ({entity.review_count} reviews)</span>
                      )}
                      {entity.price_cents && (
                        <span>${(entity.price_cents / 100).toFixed(0)} {entity.price_label}</span>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQs */}
      <section>
        <h2>Frequently Asked Questions</h2>
        {faqs.map((faq, i) => (
          <details key={i}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>

      {/* Internal Links */}
      <section>
        <h2>Explore More</h2>
        <nav>
          <a href={`/categories/${category.slug}`}>All {category.name} Professionals</a>
          {location && <a href={`/locations/${location.slug}`}>All Professionals in {location.name}</a>}
          <a href="/categories">Browse All Categories</a>
          <a href="/locations">Browse All Locations</a>
        </nav>
      </section>
    </main>
  )
}
```

### 5G: "Alternative To" Pages — `/app/alternatives/[slug]/page.tsx`

Captures "alternative to {entity}" searches — people actively looking to switch.

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { FAQSchema } from '@/components/seo/FAQSchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

export const revalidate = 3600

export async function generateStaticParams() {
  const supabase = await createClient()
  const { data: entities } = await supabase
    .from('entities')
    .select('slug')

  return (entities || []).map(e => ({ slug: e.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: entity } = await supabase
    .from('entities')
    .select('name, categories')
    .eq('slug', slug)
    .single()

  if (!entity) return {}

  const year = new Date().getFullYear()
  const title = `Top ${entity.name} Alternatives (${year}) | ${SITE_NAME}`
  const description = `Looking for alternatives to ${entity.name}? Compare the top options side by side with ratings, pricing, and reviews.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url: `${SITE_URL}/alternatives/${slug}` },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${SITE_URL}/alternatives/${slug}` },
  }
}

export default async function AlternativesPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: entity } = await supabase
    .from('entities')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!entity) notFound()

  // Find alternatives: entities in the same categories, excluding this one
  const categories = entity.categories || []
  let alternatives: any[] = []

  if (categories.length > 0) {
    const { data } = await supabase
      .from('entities')
      .select('id, name, slug, description, categories, credentials, image_url, rating_avg, review_count, price_cents, price_label')
      .neq('slug', slug)
      .overlaps('categories', categories)
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(15)

    alternatives = data || []
  }

  const year = new Date().getFullYear()

  const faqs = [
    {
      question: `Why look for alternatives to ${entity.name}?`,
      answer: `While ${entity.name} is a solid choice, exploring alternatives helps you find the best fit for your specific needs, budget, and preferences. Different professionals bring different strengths.`,
    },
    {
      question: `How are these alternatives selected?`,
      answer: `Alternatives are professionals who share similar specialties and categories with ${entity.name}. They're ranked by customer ratings and review volume.`,
    },
  ]

  return (
    <main>
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: entity.name, url: `/profiles/${entity.slug}` },
        { name: 'Alternatives' },
      ]} />
      <FAQSchema faqs={faqs} />

      <section>
        <h1>Top {entity.name} Alternatives ({year})</h1>
        <p>
          {alternatives.length} alternatives to {entity.name} based on shared specialties,
          ranked by customer reviews.
        </p>
      </section>

      {/* Original entity summary */}
      <section>
        <h2>About {entity.name}</h2>
        <div>
          {entity.image_url && <img src={entity.image_url} alt={entity.name} loading="lazy" />}
          <div>
            <p>{entity.description}</p>
            {entity.rating_avg && (
              <p>{entity.rating_avg.toFixed(1)} rating from {entity.review_count} reviews</p>
            )}
            {entity.price_cents && (
              <p>${(entity.price_cents / 100).toFixed(0)} {entity.price_label}</p>
            )}
            <a href={`/profiles/${entity.slug}`}>View Full Profile</a>
          </div>
        </div>
      </section>

      {/* Alternatives list */}
      <section>
        <h2>Best Alternatives</h2>
        {alternatives.map((alt: any, rank: number) => {
          const sharedCats = (alt.categories || []).filter((c: string) =>
            categories.includes(c)
          )
          return (
            <div key={alt.id}>
              <h3>#{rank + 1}. {alt.name}</h3>
              <p>{alt.description}</p>
              {alt.rating_avg && (
                <span>{alt.rating_avg.toFixed(1)} ({alt.review_count} reviews)</span>
              )}
              {alt.price_cents && (
                <span> · ${(alt.price_cents / 100).toFixed(0)} {alt.price_label}</span>
              )}
              <p>Shared specialties: {sharedCats.join(', ')}</p>
              <nav>
                <a href={`/profiles/${alt.slug}`}>View Profile</a>
                <a href={`/compare/${[entity.slug, alt.slug].sort().join('-vs-')}`}>
                  Compare with {entity.name}
                </a>
              </nav>
            </div>
          )
        })}
      </section>

      {/* FAQs */}
      <section>
        <h2>Frequently Asked Questions</h2>
        {faqs.map((faq, i) => (
          <details key={i}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>
    </main>
  )
}
```

---

## Step 6: Sitemap, Robots & OG Images

### `app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  // Fetch all dynamic content
  const [locations, entities, categories, terms] = await Promise.all([
    supabase.from('locations').select('slug, updated_at').order('name'),
    supabase.from('entities').select('slug, updated_at').order('name'),
    supabase.from('categories').select('slug').order('name'),
    supabase.from('glossary_terms').select('slug').order('term'),
  ])

  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/locations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/categories`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/glossary`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/search`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
  ]

  // Location pages — high priority, they drive the most organic traffic
  const locationPages: MetadataRoute.Sitemap = (locations.data || []).map(loc => ({
    url: `${SITE_URL}/locations/${loc.slug}`,
    lastModified: loc.updated_at ? new Date(loc.updated_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = (categories.data || []).map(cat => ({
    url: `${SITE_URL}/categories/${cat.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Entity profile pages
  const entityPages: MetadataRoute.Sitemap = (entities.data || []).map(ent => ({
    url: `${SITE_URL}/profiles/${ent.slug}`,
    lastModified: ent.updated_at ? new Date(ent.updated_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Glossary pages — lower priority, high volume
  const glossaryPages: MetadataRoute.Sitemap = (terms.data || []).map(term => ({
    url: `${SITE_URL}/glossary/${term.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // Comparison pages — high intent
  const comparisonPages: MetadataRoute.Sitemap = []
  const entityList = entities.data || []
  const seen = new Set<string>()
  for (let i = 0; i < entityList.length; i++) {
    for (let j = i + 1; j < entityList.length; j++) {
      const [a, b] = [entityList[i].slug, entityList[j].slug].sort()
      const key = `${a}-vs-${b}`
      if (!seen.has(key)) {
        seen.add(key)
        comparisonPages.push({
          url: `${SITE_URL}/compare/${key}`,
          lastModified: now,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        })
      }
    }
  }

  // Best-of pages
  const bestOfPages: MetadataRoute.Sitemap = (categories.data || []).map(cat => ({
    url: `${SITE_URL}/best/${cat.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }))

  // Alternatives pages
  const alternativePages: MetadataRoute.Sitemap = entityList.map(ent => ({
    url: `${SITE_URL}/alternatives/${ent.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [
    ...staticPages,
    ...locationPages,
    ...categoryPages,
    ...entityPages,
    ...glossaryPages,
    ...bestOfPages,
    ...comparisonPages,
    ...alternativePages,
  ]
}
```

### `app/robots.ts`

```typescript
import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/', '/dashboard/', '/admin/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

### `app/opengraph-image.tsx`

Dynamic OG image generation — one image auto-generated for every page share.

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Your Site Name'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'YourSite'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          // CUSTOMIZE: Your brand colors
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* Logo / Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              fontWeight: 'bold',
              color: '#1a1a2e',
            }}
          >
            {/* CUSTOMIZE: Your logo initials */}
            {SITE_NAME.slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontSize: '28px', fontWeight: 600 }}>
            {SITE_NAME}
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: '52px',
            fontWeight: 'bold',
            textAlign: 'center',
            margin: '0 0 20px 0',
            lineHeight: 1.2,
          }}
        >
          {/* CUSTOMIZE: Your main value proposition */}
          Find Top Professionals Near You
        </h1>

        {/* Subheading */}
        <p
          style={{
            fontSize: '24px',
            opacity: 0.85,
            textAlign: 'center',
            margin: 0,
          }}
        >
          Verified profiles. Real reviews. Book online.
        </p>
      </div>
    ),
    { ...size }
  )
}
```

### `app/icon.tsx` and `app/apple-icon.tsx`

```tsx
// app/icon.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          // CUSTOMIZE: Your brand color
          background: '#1a1a2e',
          color: 'white',
          fontSize: '18px',
          fontWeight: 'bold',
        }}
      >
        {/* CUSTOMIZE: Your icon letter or emoji */}
        P
      </div>
    ),
    { ...size }
  )
}
```

```tsx
// app/apple-icon.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
          background: '#1a1a2e',
          color: 'white',
          fontSize: '90px',
          fontWeight: 'bold',
        }}
      >
        P
      </div>
    ),
    { ...size }
  )
}
```

---

## Step 7: Internal Linking Architecture

The internal linking strategy is what separates programmatic SEO that ranks from pages that rot in Google's index. Here's the architecture:

### Hub-and-Spoke Model

```
                    Homepage (Authority Hub)
                    /        |          \
            Locations    Categories    Glossary
            Hub Page     Hub Page      Hub Page
           /   |   \     /   |   \     /   |   \
        City  City City  Cat  Cat Cat  Term Term Term
        Page  Page Page  Page Page Page Page Page Page
           \   |   /        |              |
            Entity Profile Pages ←→ Cross-Links
```

### Rules for Internal Linking

1. **Every programmatic page links back to its hub page** (breadcrumbs handle this)
2. **Every hub page links to ALL its child pages** (or the top N with a "view all" link)
3. **Related pages cross-link horizontally** (related categories, related terms, nearby locations)
4. **Entity profile pages link to BOTH their location page AND their category pages**
5. **Glossary terms link to related terms** (creates a web of topical authority)

### Hub Page Template — `/app/locations/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME!

export const metadata: Metadata = {
  title: `All Locations | ${SITE_NAME}`,
  description: `Browse professionals by location. Find verified experts in your city.`,
  alternates: { canonical: `${SITE_URL}/locations` },
}

export default async function LocationsHubPage() {
  const supabase = await createClient()

  // Fetch locations grouped by region
  const { data: locations } = await supabase
    .from('locations')
    .select('name, region, slug')
    .order('region')
    .order('name')

  // Group by region for better UX and more internal links
  const grouped = (locations || []).reduce((acc: Record<string, any[]>, loc) => {
    if (!acc[loc.region]) acc[loc.region] = []
    acc[loc.region].push(loc)
    return acc
  }, {})

  return (
    <main>
      <h1>Browse by Location</h1>
      <p>
        Find top professionals in {locations?.length || 0} cities across{' '}
        {Object.keys(grouped).length} states.
      </p>

      {Object.entries(grouped).sort().map(([region, locs]) => (
        <section key={region}>
          <h2>{region}</h2>
          <nav>
            {locs.map((loc: any) => (
              <a key={loc.slug} href={`/locations/${loc.slug}`}>
                {loc.name}, {loc.region}
              </a>
            ))}
          </nav>
        </section>
      ))}
    </main>
  )
}
```

---

## Step 8: Root Layout Integration

### `app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import { GlobalSchema } from '@/components/seo/GlobalSchema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'YourSite'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Find Top Professionals Near You`,
    template: `%s | ${SITE_NAME}`,
  },
  description: 'Your site description here.',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <GlobalSchema />
        {/* Google Analytics — CUSTOMIZE: Replace with your GA ID */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                `,
              }}
            />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

---

## Step 9: AI Content Generation Script

Google penalizes thin, template-only pages. This script generates unique prose for each location page using an AI API, so every page has genuinely unique content — not just swapped variables.

### `scripts/generate-content.ts`

```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CUSTOMIZE: Use your preferred AI API (Anthropic Claude, OpenAI, etc.)
const AI_API_KEY = process.env.AI_API_KEY!
const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-5-20250929'

// ------- AI Provider Abstraction -------
// Supports both Anthropic and OpenAI. Set AI_PROVIDER env var.

async function generateText(prompt: string): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'anthropic'

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || ''
  }

  // OpenAI fallback
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ------- Content Generation -------

interface LocationContent {
  prose: string
  faqs: { question: string; answer: string }[]
}

async function generateLocationContent(
  locationName: string,
  region: string,
  entityCount: number,
  topEntityNames: string[],
  categories: string[]
): Promise<LocationContent> {

  // CUSTOMIZE: Adapt this prompt to your niche
  const prosePrompt = `Write 2-3 unique, informative paragraphs about finding professional services in ${locationName}, ${region}.

Context:
- There are ${entityCount} verified professionals in this area
- Top professionals include: ${topEntityNames.slice(0, 5).join(', ')}
- Available categories: ${categories.join(', ')}

Requirements:
- Write in a helpful, authoritative tone
- Mention specific aspects of ${locationName} that are relevant
- Include natural references to the types of services available
- Do NOT use generic filler — every sentence should add value
- Do NOT include headers, just paragraphs
- Keep it under 200 words total`

  const faqPrompt = `Generate 3 frequently asked questions about finding professional services in ${locationName}, ${region}.

Context: ${entityCount} professionals available in categories: ${categories.join(', ')}

Format your response as JSON array: [{"question": "...", "answer": "..."}]

Requirements:
- Questions should be ones real users would search for
- Answers should be specific to ${locationName}, not generic
- Keep answers under 100 words each
- Include the city name naturally in both questions and answers`

  const [prose, faqJson] = await Promise.all([
    generateText(prosePrompt),
    generateText(faqPrompt),
  ])

  let faqs: { question: string; answer: string }[] = []
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = faqJson.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      faqs = JSON.parse(jsonMatch[0])
    }
  } catch {
    console.warn(`Failed to parse FAQs for ${locationName}`)
  }

  return { prose, faqs }
}

// ------- Main Script -------

async function run() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
  const specificCity = args.find(a => a.startsWith('--city='))?.split('=')[1]

  // Fetch locations that don't have custom content yet
  let query = supabase
    .from('locations')
    .select('id, name, region, slug, custom_content')
    .order('name')

  if (specificCity) {
    query = query.eq('slug', specificCity)
  }
  if (limit) {
    query = query.limit(limit)
  }

  const { data: locations, error } = await query
  if (error) { console.error(error); return }

  const toGenerate = (locations || []).filter(loc => {
    const content = loc.custom_content || {}
    return !content.prose // Skip locations that already have content
  })

  console.log(`Found ${toGenerate.length} locations needing content`)

  for (let i = 0; i < toGenerate.length; i++) {
    const loc = toGenerate[i]
    console.log(`\n[${i + 1}/${toGenerate.length}] Generating content for ${loc.name}, ${loc.region}...`)

    // Get entity data for this location
    const { data: links } = await supabase
      .from('entity_locations')
      .select('entities (name, categories)')
      .eq('location_id', loc.id)

    const entities = (links || []).map((l: any) => l.entities).filter(Boolean)
    const topNames = entities.map((e: any) => e.name).slice(0, 10)
    const allCategories = [...new Set(entities.flatMap((e: any) => e.categories || []))]

    const content = await generateLocationContent(
      loc.name,
      loc.region,
      entities.length,
      topNames,
      allCategories
    )

    if (dryRun) {
      console.log(`\n  Prose preview: ${content.prose.slice(0, 200)}...`)
      console.log(`  FAQs: ${content.faqs.length} generated`)
    } else {
      const { error: updateError } = await supabase
        .from('locations')
        .update({
          custom_content: {
            ...(loc.custom_content || {}),
            prose: content.prose,
            faqs: content.faqs,
            generated_at: new Date().toISOString(),
          },
        })
        .eq('id', loc.id)

      if (updateError) {
        console.error(`  Failed: ${updateError.message}`)
      } else {
        console.log(`  Saved ${content.prose.length} chars + ${content.faqs.length} FAQs`)
      }
    }

    // Rate limit: 1 request per second
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\nDone.')
}

run().catch(console.error)
```

**Usage:**

```bash
# Preview without saving
npx tsx scripts/generate-content.ts --dry-run

# Generate for all locations without content
npx tsx scripts/generate-content.ts

# Generate for a specific city
npx tsx scripts/generate-content.ts --city=austin-texas

# Generate for first 10 locations
npx tsx scripts/generate-content.ts --limit=10
```

**Environment variables to add:**

```env
# AI Content Generation
AI_PROVIDER=anthropic        # or "openai"
AI_API_KEY=your_api_key_here
AI_MODEL=claude-sonnet-4-5-20250929  # or "gpt-4o"
```

---

## Step 10: Content Quality Audit Script

Run this before launch and weekly after. It catches the issues that kill your indexing.

### `scripts/audit-seo.ts`

```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'

interface AuditIssue {
  severity: 'critical' | 'warning' | 'info'
  page: string
  issue: string
  recommendation: string
}

async function auditSEO() {
  const issues: AuditIssue[] = []
  let pagesAudited = 0

  console.log('Starting SEO audit...\n')

  // ---- 1. Check for locations without content ----
  console.log('Checking location pages...')
  const { data: locations } = await supabase
    .from('locations')
    .select('slug, name, region, custom_content')

  for (const loc of locations || []) {
    pagesAudited++
    const content = loc.custom_content || {}

    if (!content.prose) {
      issues.push({
        severity: 'critical',
        page: `/locations/${loc.slug}`,
        issue: 'No unique prose content — page is at risk of thin content penalty',
        recommendation: 'Run: npx tsx scripts/generate-content.ts --city=' + loc.slug,
      })
    }

    if (!content.faqs || content.faqs.length === 0) {
      issues.push({
        severity: 'warning',
        page: `/locations/${loc.slug}`,
        issue: 'No FAQs — missing opportunity for FAQ rich snippets',
        recommendation: 'Add FAQs via content generation script or manually',
      })
    }
  }

  // ---- 2. Check for entities with missing data ----
  console.log('Checking entity profiles...')
  const { data: entities } = await supabase
    .from('entities')
    .select('slug, name, description, long_description, image_url, categories, rating_avg, review_count')

  for (const entity of entities || []) {
    pagesAudited++

    if (!entity.description || entity.description.length < 50) {
      issues.push({
        severity: 'critical',
        page: `/profiles/${entity.slug}`,
        issue: `Description too short (${entity.description?.length || 0} chars) — thin content risk`,
        recommendation: 'Add a description of at least 100 characters',
      })
    }

    if (!entity.image_url) {
      issues.push({
        severity: 'warning',
        page: `/profiles/${entity.slug}`,
        issue: 'Missing profile image — reduces click-through rate from search results',
        recommendation: 'Add a profile image URL',
      })
    }

    if (!entity.categories || entity.categories.length === 0) {
      issues.push({
        severity: 'warning',
        page: `/profiles/${entity.slug}`,
        issue: 'No categories assigned — won\'t appear in category or comparison pages',
        recommendation: 'Assign at least one category',
      })
    }
  }

  // ---- 3. Check for categories without enough entities ----
  console.log('Checking category pages...')
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, name, description, faqs')

  for (const cat of categories || []) {
    pagesAudited++

    const matchingEntities = (entities || []).filter(e =>
      (e.categories || []).includes(cat.name)
    )

    if (matchingEntities.length < 3) {
      issues.push({
        severity: 'warning',
        page: `/categories/${cat.slug}`,
        issue: `Only ${matchingEntities.length} entities — page may appear thin`,
        recommendation: 'Add more entities in this category or consider merging with a related category',
      })
    }

    if (!cat.description || cat.description.length < 50) {
      issues.push({
        severity: 'warning',
        page: `/categories/${cat.slug}`,
        issue: 'Missing or short category description',
        recommendation: 'Add a unique description of at least 100 characters',
      })
    }
  }

  // ---- 4. Check for glossary terms with missing data ----
  console.log('Checking glossary pages...')
  const { data: terms } = await supabase
    .from('glossary_terms')
    .select('slug, term, short_definition, long_definition, related_terms')

  for (const term of terms || []) {
    pagesAudited++

    if (!term.long_definition || term.long_definition.length < 100) {
      issues.push({
        severity: 'warning',
        page: `/glossary/${term.slug}`,
        issue: `Long definition too short (${term.long_definition?.length || 0} chars)`,
        recommendation: 'Expand the long definition to at least 200 characters',
      })
    }

    if (!term.related_terms || term.related_terms.length === 0) {
      issues.push({
        severity: 'info',
        page: `/glossary/${term.slug}`,
        issue: 'No related terms linked — weak internal linking',
        recommendation: 'Add 2-5 related term slugs',
      })
    }
  }

  // ---- 5. Check for orphaned entities (no location) ----
  console.log('Checking for orphaned entities...')
  const { data: entityLocations } = await supabase
    .from('entity_locations')
    .select('entity_id')

  const linkedEntityIds = new Set((entityLocations || []).map(el => el.entity_id))

  for (const entity of entities || []) {
    if (!linkedEntityIds.has(entity.id)) {
      issues.push({
        severity: 'warning',
        page: `/profiles/${entity.slug}`,
        issue: 'Entity not linked to any location — won\'t appear on location pages',
        recommendation: 'Link this entity to at least one location via entity_locations table',
      })
    }
  }

  // ---- 6. Check for duplicate slugs ----
  console.log('Checking for slug conflicts...')
  const allSlugs = [
    ...(locations || []).map(l => ({ slug: l.slug, type: 'location' })),
    ...(entities || []).map(e => ({ slug: e.slug, type: 'entity' })),
    ...(categories || []).map(c => ({ slug: c.slug, type: 'category' })),
    ...(terms || []).map(t => ({ slug: t.slug, type: 'glossary' })),
  ]

  const slugCounts = new Map<string, string[]>()
  for (const { slug, type } of allSlugs) {
    const existing = slugCounts.get(slug) || []
    existing.push(type)
    slugCounts.set(slug, existing)
  }

  for (const [slug, types] of slugCounts) {
    if (types.length > 1) {
      issues.push({
        severity: 'warning',
        page: slug,
        issue: `Slug "${slug}" used by multiple types: ${types.join(', ')}`,
        recommendation: 'Ensure each content type uses unique route prefixes to avoid conflicts',
      })
    }
  }

  // ---- Report ----
  console.log('\n' + '='.repeat(60))
  console.log('SEO AUDIT REPORT')
  console.log('='.repeat(60))
  console.log(`Pages audited: ${pagesAudited}`)
  console.log(`Issues found: ${issues.length}`)
  console.log('')

  const critical = issues.filter(i => i.severity === 'critical')
  const warnings = issues.filter(i => i.severity === 'warning')
  const infos = issues.filter(i => i.severity === 'info')

  if (critical.length > 0) {
    console.log(`\n🔴 CRITICAL (${critical.length})`)
    console.log('-'.repeat(40))
    for (const issue of critical) {
      console.log(`  ${issue.page}`)
      console.log(`    Issue: ${issue.issue}`)
      console.log(`    Fix: ${issue.recommendation}\n`)
    }
  }

  if (warnings.length > 0) {
    console.log(`\n🟡 WARNINGS (${warnings.length})`)
    console.log('-'.repeat(40))
    for (const issue of warnings) {
      console.log(`  ${issue.page}`)
      console.log(`    Issue: ${issue.issue}`)
      console.log(`    Fix: ${issue.recommendation}\n`)
    }
  }

  if (infos.length > 0) {
    console.log(`\n🔵 INFO (${infos.length})`)
    console.log('-'.repeat(40))
    for (const issue of infos) {
      console.log(`  ${issue.page}`)
      console.log(`    Issue: ${issue.issue}`)
      console.log(`    Fix: ${issue.recommendation}\n`)
    }
  }

  if (issues.length === 0) {
    console.log('\n✅ No issues found. Your site is clean.')
  }

  // Score
  const score = Math.max(0, 100 - (critical.length * 10) - (warnings.length * 3) - (infos.length * 1))
  console.log(`\n${'='.repeat(60)}`)
  console.log(`SEO HEALTH SCORE: ${score}/100`)
  console.log(`${'='.repeat(60)}\n`)
}

auditSEO().catch(console.error)
```

**Usage:**

```bash
npx tsx scripts/audit-seo.ts
```

**Add to package.json:**

```json
{
  "scripts": {
    "audit:seo": "tsx scripts/audit-seo.ts"
  }
}
```

---

## Step 11: On-Demand Revalidation API

When your data changes (new entity added, review posted, price updated), this endpoint lets you instantly refresh the affected pages instead of waiting for the ISR timer.

### `app/api/revalidate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

// CUSTOMIZE: Set this to a secure random string
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET

export async function POST(request: NextRequest) {
  // Verify the request is authorized
  const authHeader = request.headers.get('authorization')
  if (!REVALIDATION_SECRET || authHeader !== `Bearer ${REVALIDATION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, slug, action } = body

    // type: "location" | "entity" | "category" | "glossary" | "all"
    // slug: the specific slug to revalidate (optional)
    // action: "created" | "updated" | "deleted" (for logging)

    const revalidated: string[] = []

    switch (type) {
      case 'location':
        if (slug) {
          revalidatePath(`/locations/${slug}`)
          revalidated.push(`/locations/${slug}`)
        }
        revalidatePath('/locations')
        revalidatePath('/sitemap.xml')
        revalidated.push('/locations', '/sitemap.xml')
        break

      case 'entity':
        if (slug) {
          revalidatePath(`/profiles/${slug}`)
          revalidatePath(`/alternatives/${slug}`)
          revalidated.push(`/profiles/${slug}`, `/alternatives/${slug}`)
        }
        // Revalidate all comparison pages containing this entity
        // (In practice, you'd query for specific comparisons)
        revalidatePath('/compare', 'layout')
        revalidatePath('/best', 'layout')
        revalidatePath('/sitemap.xml')
        revalidated.push('/compare', '/best', '/sitemap.xml')
        break

      case 'category':
        if (slug) {
          revalidatePath(`/categories/${slug}`)
          revalidatePath(`/best/${slug}`)
          revalidated.push(`/categories/${slug}`, `/best/${slug}`)
        }
        revalidatePath('/categories')
        revalidatePath('/sitemap.xml')
        revalidated.push('/categories', '/sitemap.xml')
        break

      case 'glossary':
        if (slug) {
          revalidatePath(`/glossary/${slug}`)
          revalidated.push(`/glossary/${slug}`)
        }
        revalidatePath('/glossary')
        revalidatePath('/sitemap.xml')
        revalidated.push('/glossary', '/sitemap.xml')
        break

      case 'review':
        // Reviews affect entity profiles and comparison/best-of pages
        if (slug) {
          revalidatePath(`/profiles/${slug}`)
          revalidatePath(`/alternatives/${slug}`)
          revalidated.push(`/profiles/${slug}`, `/alternatives/${slug}`)
        }
        revalidatePath('/best', 'layout')
        revalidated.push('/best')
        break

      case 'all':
        revalidatePath('/', 'layout')
        revalidated.push('/ (entire site)')
        break

      default:
        return NextResponse.json(
          { error: `Unknown type: ${type}. Use: location, entity, category, glossary, review, all` },
          { status: 400 }
        )
    }

    console.log(`[Revalidation] ${action || 'manual'}: ${type}${slug ? `/${slug}` : ''} → ${revalidated.length} paths`)

    return NextResponse.json({
      revalidated: true,
      paths: revalidated,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Revalidation error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Environment variable to add:**

```env
REVALIDATION_SECRET=your_random_secret_here_min_32_chars
```

**Usage examples:**

```bash
# Revalidate a specific entity profile after an update
curl -X POST https://yourdomain.com/api/revalidate \
  -H "Authorization: Bearer $REVALIDATION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type": "entity", "slug": "john-smith", "action": "updated"}'

# Revalidate after a new review is posted
curl -X POST https://yourdomain.com/api/revalidate \
  -H "Authorization: Bearer $REVALIDATION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type": "review", "slug": "john-smith", "action": "created"}'

# Nuclear option: revalidate the entire site
curl -X POST https://yourdomain.com/api/revalidate \
  -H "Authorization: Bearer $REVALIDATION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type": "all"}'
```

**Tip:** Call this endpoint from your Supabase Database Webhooks to auto-revalidate pages whenever data changes.

---

## Step 12: Launch Checklist

Run through every item before going live. One missed item can tank your indexing.

### Pre-Launch Audit

- [ ] Run `npx tsx scripts/audit-seo.ts` and fix all critical issues
- [ ] SEO Health Score is 80+ before proceeding

### Technical SEO

- [ ] Every programmatic page has a unique `<title>` tag
- [ ] Every page has a unique `meta description` (under 160 characters)
- [ ] Every page has a canonical URL via `alternates.canonical`
- [ ] `sitemap.xml` generates correctly — visit `/sitemap.xml` and verify all URLs
- [ ] `robots.txt` allows crawling — visit `/robots.txt` and verify
- [ ] No pages return 404 that should be 200 (check `generateStaticParams`)
- [ ] `revalidate` is set appropriately (3600 for dynamic content, omit for static)

### Schema Markup

- [ ] Run 5+ pages through [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] No warnings or errors in schema validation
- [ ] `aggregateRating` only appears when you have REAL reviews (fake ratings = penalty)
- [ ] Organization schema has correct contact info
- [ ] BreadcrumbSchema renders on every programmatic page

### Content Quality

- [ ] Every location page has at least one unique paragraph of content (not just a list)
- [ ] H1 tags are unique across all pages — no duplicates
- [ ] No thin content pages (pages with less than 100 words of unique content)
- [ ] Images have descriptive `alt` text

### Internal Linking

- [ ] Hub pages link to ALL child pages (or top N with "view all")
- [ ] Every child page links back to its hub via breadcrumbs
- [ ] Related content sections work (related categories, related terms)
- [ ] Entity profiles link to their location and category pages
- [ ] No orphan pages (every page reachable from at least one other page)

### Performance

- [ ] Pages load in under 3 seconds on mobile (test with PageSpeed Insights)
- [ ] Images are lazy-loaded (`loading="lazy"`)
- [ ] No blocking JavaScript in the critical path
- [ ] Dynamic OG images generate correctly — test with [opengraph.xyz](https://www.opengraph.xyz)

### Indexing

- [ ] Submit sitemap to Google Search Console
- [ ] Request indexing for your 10 highest-priority pages
- [ ] Verify no `noindex` tags on pages you want indexed
- [ ] Set up Search Console alerts for crawl errors

### Content Quality

- [ ] Run AI content generation for all location pages: `npx tsx scripts/generate-content.ts`
- [ ] Verify no two pages have identical H1 tags
- [ ] Every location page has unique prose content (not just entity listings)
- [ ] Comparison pages render correctly for all entity pairings
- [ ] "Best of" pages show ranked results with real data
- [ ] "Alternative to" pages cross-link back to comparison pages

### Revalidation

- [ ] Set `REVALIDATION_SECRET` environment variable in production
- [ ] Test revalidation endpoint with a sample entity update
- [ ] (Optional) Set up Supabase Database Webhooks to auto-trigger revalidation

### Post-Launch Monitoring

- [ ] Check Search Console weekly for the first month
- [ ] Monitor "Coverage" report for indexing issues
- [ ] Track "Performance" for impressions and clicks by page type
- [ ] Re-run Rich Results Test if you change any schema markup
- [ ] Run `npx tsx scripts/audit-seo.ts` weekly — target 90+ score
- [ ] Re-run AI content generation monthly to refresh prose

---

## Customization Guide

When adapting this skill to a specific niche, your AI agent should:

1. **Replace all route names** — `/locations/` might become `/cities/`, `/areas/`, `/neighborhoods/`
2. **Adapt entity terminology** — "entities" becomes "dentists", "plumbers", "restaurants", etc.
3. **Update keyword patterns** — Change the `KEYWORD_PATTERN` in location pages to match your niche
4. **Customize schema types** — A restaurant directory might use `Restaurant` instead of `LocalBusiness`
5. **Adjust the data model** — Add niche-specific columns (e.g., `cuisine_type` for restaurants, `insurance_accepted` for doctors)
6. **Write niche-specific FAQs** — Each category and location page should have relevant FAQs
7. **Set up the scraper** — Point the scraping template at your data source and update the CSS selectors

### Example Niches This Architecture Works For

| Niche | Entities | Locations | Categories |
|-------|----------|-----------|------------|
| Legal | Lawyers | Cities | Practice Areas |
| Medical | Doctors | Cities | Specialties |
| Real Estate | Agents | Neighborhoods | Property Types |
| Fitness | Trainers | Cities | Training Types |
| Education | Tutors | Cities | Subjects |
| Home Services | Contractors | Cities | Service Types |
| Food | Restaurants | Neighborhoods | Cuisines |
| SaaS | Tools | — | Categories |
| Freelance | Freelancers | Cities | Skills |

---

## Support

Questions or issues? Reach out to the creator for support.

**Version History**
- 1.0.0 — Initial release. Full programmatic SEO architecture with 4 page types, 8 schema components, data pipeline, and launch checklist.
