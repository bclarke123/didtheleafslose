# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Run production server

## Architecture

This is a simple single-page Next.js 16 app (App Router) that shows whether the Toronto Maple Leafs lost their most recent NHL game.

**Data Flow:** The main page (`app/page.tsx`) is a server component that fetches game data from the NHL API (`api-web.nhle.com`), finds the most recent completed Leafs game, and renders a large "YES" or "NO" based on the result.

**Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript. Deployed to Netlify.
