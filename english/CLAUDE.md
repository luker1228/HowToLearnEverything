# English Learning System

This directory contains a comprehensive English learning system powered by AI coaching. The system is designed to provide personalized English instruction, continuous error correction, and structured learning plans.

## Overview

The English learning system focuses on practical improvement through:
- **Personalized coaching**: AI-driven English coach that adapts to your level and goals
- **Continuous practice**: Daily lessons with input materials and output tasks
- **Error tracking**: Record and review your common mistakes periodically
- **Structured planning**: Convert learning goals into actionable plans
- **Real-world application**: Practice with authentic materials (articles, emails, meeting notes, etc.)

## Core Philosophy

- **Interactive learning**: Every session includes both input (reading/listening) and output (speaking/writing)
- **Immediate feedback**: Real-time error correction with explanations
- **Focused sessions**: 20-30 minute lessons targeting specific skills
- **English immersion**: Primary interaction in English with minimal Chinese support for complex grammar
- **Progressive difficulty**: Build from simple to complex based on your level

## When to Use This System

Use this English learning system when you want to:
- Prepare for IELTS or other English exams
- Improve business English (meetings, presentations, emails, resumes)
- Enhance daily conversation skills
- Practice with real-world materials (articles, videos, documents)
- Establish a consistent learning routine
- Get systematic error correction and review

## Key Features

### 1. English Coach Skill
The core component is the `english-coach` skill which:
- Conducts interactive English lessons
- Provides immediate error correction
- Designs personalized learning plans
- Tracks and reviews common mistakes
- Converts real materials into learning exercises

### 2. Learning Plans
The system generates structured plans stored in:
```
.learnx/english/plans/
```

Common plan types:
- `1-week-trial-plan.md` - One week trial learning plan
- `1-week-english-plan.md` - Weekly learning structure
- `12-week-english-plan.md` - Comprehensive 12-week program
- `ielts-12-week-plan.md` - IELTS preparation plan

### 3. Lesson Structure
Every session follows a consistent 5-part structure:

1. **Warm-up** - Brief conversation to activate English
2. **Input material** - Reading/listening content at appropriate level
3. **Output task** - Speaking/writing exercise based on input
4. **Error correction** - Detailed feedback with explanations
5. **Review** - Summary of learning points and next steps

### 4. Error Tracking System
- Records common mistakes during sessions
- Categorizes errors by type (grammar, vocabulary, pronunciation)
- Provides periodic reviews of high-frequency errors
- Tracks improvement over time

## How to Use

### Starting a Learning Session

When you're ready to practice English, the coach will:
1. Assess your current level and goals
2. Select appropriate materials for your level
3. Guide you through the lesson structure
4. Provide detailed feedback on your output
5. Track areas for improvement

### Working with Learning Plans

To create a structured learning plan:
1. Define your goals (IELTS score, business communication, etc.)
2. Specify your timeframe (weeks/months)
3. Identify your current level
4. Generate a personalized plan
5. Follow the daily/weekly sessions

### Using Real Materials

Upload authentic materials for practice:
- Business documents (emails, reports, presentations)
- Academic content (articles, research papers)
- Media content (video subtitles, podcasts)
- Creative materials (stories, dialogues)

The coach will convert these into structured lessons.

## Directory Structure

```
english/
├── CLAUDE.md                      # This file - system overview
├── english-coach-skill/          # Main coaching skill
│   ├── SKILL.md                  # Skill definition and behaviors
│   ├── prompts/                  # System prompts for different modes
│   └── references/               # Reference materials and templates
└── .learnx/                      # Generated learning content
    └── english/
        └── plans/               # Your personalized learning plans

```

## Learning Principles

### Session Guidelines
- **Duration**: 20-30 minutes per session
- **Frequency**: Daily practice recommended
- **Focus**: One specific skill per session
- **Balance**: Mix of input and output activities
- **Progression**: Build on previous lessons

### Interaction Style
- **Primary language**: English interaction
- **Support language**: Minimal Chinese for complex grammar explanations
- **Coaching approach**: Guide rather than lecture
- **Error correction**: Immediate with explanations
- **Encouragement**: Positive reinforcement with constructive feedback

### Progress Tracking
- Record common errors and review periodically
- Celebrate improvements and milestones
- Adjust difficulty based on performance
- Reassess goals and plans regularly

## Skill Boundaries

The English Coach skill focuses on:
- ✅ Interactive coaching and teaching
- ✅ Lesson planning and material preparation
- ✅ Error correction and feedback
- ✅ Learning plan generation
- ✅ Progress tracking and review

The skill does NOT handle:
- ❌ CLI state management (handled by learn-cli skills)
- ❌ File system operations for goal/point management
- ❌ Database operations for review logs
- ❌ Pure translation tasks
- ❌ Dictionary lookups or resource recommendations

## Integration with Other Skills

For comprehensive learning management, this system works with:
- **learn-cli skills**: For CLI-based goal tracking and state management
- **writing skills**: For advanced writing practice and refinement
- **research skills**: For finding appropriate learning materials

## Getting Started

To begin your English learning journey:

1. **Initial Assessment**: Start with a conversation to assess your level
2. **Goal Setting**: Define clear, achievable objectives
3. **Plan Creation**: Generate a personalized learning plan
4. **Daily Practice**: Engage in consistent sessions
5. **Regular Review**: Periodically assess progress and adjust

## Support and Improvement

This system is designed to be:
- **Adaptive**: Adjusts to your learning style and pace
- **Comprehensive**: Covers all language skills (reading, writing, speaking, listening)
- **Practical**: Focuses on real-world language use
- **Sustainable**: Builds long-term learning habits

The coach will continuously refine your learning experience based on your performance and feedback.