# LunaNav — Demo Guide

## 1. Project Overview

LunaNav is a lunar landing-site decision-support prototype developed for NASA's Lunar Landing Site Navigator challenge.

The dashboard allows users to select a lunar landing-site preset, enter coordinates and a landing date, view illustrative mission indicators, and compare multiple landing-site scenarios.

The long-term goal is to help mission planners explore how sunlight, Earth visibility, terrain conditions, and mission requirements could influence landing-site and landing-date decisions.

**Important:** The current frontend is an illustrative prototype. Its displayed mission values, timelines, and scenario assessments are fixed demo data, not scientifically computed lunar predictions or operational mission recommendations.

## 2. Run the Frontend Demo

### Requirements

- Node.js and npm installed.
- No API keys or paid services required.
- Python is not required to run the frontend.

### Windows PowerShell Commands

From the repository root:

```powershell
cd frontend
npm install
npm run dev