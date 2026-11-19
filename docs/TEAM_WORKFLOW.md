# LunaNav — Team Workflow

## 1. Purpose

This document describes the development workflow, collaboration practices, task coordination, and project management approach for LunaNav.

The goal is to keep development organized, maintain code quality, avoid conflicts, and ensure that all team members work toward the same project objectives.

## 2. Project Development Structure

LunaNav is organized into the following major development areas:

### Frontend Development

Responsibilities:

- Develop the React and TypeScript user interface.
- Build the lunar landing-site dashboard.
- Implement landing-site selection and coordinate inputs.
- Display mission indicators and timelines.
- Develop the scenario comparison interface.
- Maintain a clear and interactive user experience.

### Backend Development

Responsibilities:

- Develop the FastAPI application.
- Define API request and response schemas.
- Implement API routes and service interfaces.
- Maintain provider architecture.
- Perform backend validation and verification.
- Prepare the foundation for future scientific integrations.

### Scientific Data and Research

Responsibilities:

- Identify relevant NASA datasets and scientific resources.
- Research LRO/LOLA elevation data.
- Study NAIF/SPICE for future Sun and Earth geometry calculations.
- Understand terrain, illumination, and visibility requirements.
- Document data sources, assumptions, and limitations.
- Ensure scientific claims are supported by verified data and calculations.

### Documentation and Demonstration

Responsibilities:

- Maintain project documentation.
- Prepare demonstration instructions.
- Document implemented features and limitations.
- Maintain technical status information.
- Prepare clear explanations for presentations and evaluations.

These are project work areas. Individual task ownership should be agreed upon by the team.

## 3. Development Workflow

The team follows an organized development process:

1. Understand the project challenge and requirements.
2. Break the requirements into smaller development tasks.
3. Assign responsibilities among team members.
4. Implement features in the appropriate project area.
5. Test changes locally.
6. Review code and documentation.
7. Integrate approved changes.
8. Update project documentation.
9. Prepare and verify the final demonstration.

## 4. Repository Structure

The project repository is organized into the following main directories:

- `frontend/` — React and TypeScript application.
- `backend/` — FastAPI application and backend services.
- `docs/` — Project documentation and source references.

Important documentation files include:

- `docs/architecture.md`
- `docs/source-registry.json`
- `docs/DEMO_GUIDE.md`
- `docs/TEAM_WORKFLOW.md`
- `docs/TECHNICAL_STATUS.md`

## 5. Git and Collaboration Practices

Git and GitHub are used for version control and collaboration.

Recommended practices:

- Work on a separate branch for individual tasks.
- Avoid making unrelated changes in the same branch.
- Pull the latest approved changes before starting new work when network access is available.
- Review changes before committing.
- Use meaningful commit messages.
- Share completed work through pull requests for team review.
- Avoid committing temporary files, local environments, or credentials.
- Do not overwrite another team member's work without coordination.

### Useful Git Commands

Check the current branch:

```powershell
git branch --show-current