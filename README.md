# MongoDB Gang Points System

A Discord bot for tracking gang activities and points, built with Discord.js and MongoDB.

## Features

- Gang-based point system
- Activity tracking in gang-specific channels
- Leaderboard commands for individual and gang rankings
- Weekly point resets and statistics
- Cooldown and duplicate message detection

## Commands

- `/leaderboard [gang]` - View the server or gang leaderboard
- `/weeklyLeaderboard [gang]` - View the weekly leaderboard
- `/ganginfo [gang]` - View detailed information about a gang
- `/userinfo [user]` - View a user's points and statistics
- `/awardpoints user:@user points:10 [reason]` - Award points to a user (Admin only)
- `/activity [gang]` - View activity statistics for gangs

## How Points Work

- Users earn points by sending messages in their gang's channel
- Each valid message awards 1 point (both to the user and their gang)
- Messages must be at least 5 characters long
- Common greetings and duplicate messages don't count
- There's a 5-minute cooldown between point-earning messages

## Development

The system is designed around a MongoDB database with collections for:
- Users
- Gangs
- Activity logs

Gang affiliations are configured in the `config/gangs.js` file, mapping Discord roles to gangs.

## Setup Requirements

1. Node.js 16+
2. MongoDB database
3. Discord application with bot permissions

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Configure environment variables
4. Run `npm run deploy` to deploy slash commands
5. Run `npm start` to start the bot

## Recent Changes

- Cooldown increased to 5 minutes between point-earning messages
- Improved concurrency handling for high-activity servers
- Added automatic user registration in gang channels
- Fixed tracking of gang total points

## Requirements

- Node.js v16.9.0 or higher
- MongoDB database
- Discord bot token
- (Optional) Google Sheets API credentials for Engage Bot integration

## Usage

### Admin Commands

- `/setupgang`: Set up a new gang with a role, ID, name, and channel

### Moderator Commands

- `/award`: Award points to a user
- `/awardgang`: Award points to a gang
- `/synctwitter`: Sync Twitter engagement points from Engage Bot

### User Commands

- `/leaderboard`: View the member points leaderboard
- `/gangs`: View the gang leaderboard
- `/linktwitter`: Link your Discord account to your Twitter account
- `/help`: Show all available commands

## Point Sources

Points can be earned from:
- Twitter engagement
- Games & competitions
- Art & memes
- Server activity
- Gang activity

## Twitter Integration with Engage Bot

This bot can integrate with Engage Bot's Twitter tracking:

1. Users link their Twitter accounts with `/linktwitter`
2. Run Engage Bot's `/userlist` command to generate a Google Sheet
3. Configure the Google Sheet ID in your `.env` file
4. Run `/synctwitter` to award points based on Twitter engagement

## License

ISC

---

Created by Karatekid05 