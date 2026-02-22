<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Knock Knock SaaS Backend

This NestJS backend powers a multi-tenant AI outreach platform. It includes:

- JWT auth and user settings
- Gmail OAuth2 integration (no app passwords)
- AI provider abstraction (OpenAI, Anthropic, Grok)
- CSV recipient imports
- BullMQ background jobs with Redis
- SSE progress streaming
- Email history

### Quick start

1. Install dependencies

2. Copy env file

3. Run database migrations

4. Start the API

See the full instructions below for details.

## Environment variables

Copy the example env file and fill in values:

```
cp .env.example .env
```

Required variables:

- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- ENCRYPTION_KEY (32 bytes base64)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI

## Prisma

Generate Prisma client:

```
pnpm run prisma:generate
```

Run migrations:

```
pnpm run prisma:migrate
```

## Running the server

```
pnpm run start:dev
```

## Core endpoints

- POST /auth/register
- POST /auth/login
- GET /integrations/gmail/connect
- GET /integrations/gmail/callback
- POST /ai/key
- GET /ai/providers
- POST /recipients/import
- GET /recipients
- POST /jobs/start
- POST /jobs/:id/pause
- POST /jobs/:id/resume
- POST /jobs/:id/retry
- GET /jobs/:id/status
- GET /jobs/:id/stream (SSE)
- GET /emails/sent

## Resume links via Google Drive

All resume references now point to shared Google Drive files. Users must step through these actions:

- Upload the resume to Google Drive and set the sharing level to “Anyone with the link can view.”
- Copy the shared link (e.g., `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`).
- Submit the link through the API so it can be attached to outbound emails.

Routes

- `POST /users/resumes/drive-link` → `{ "sharedUrl": "https://drive.google.com/…" }`
- `GET /users/resumes` → lists saved records `{ id, sharedUrl, fileId, createdAt }`
- `DELETE /users/resumes/:id` → removes one of the saved links

Each resume record keeps the Drive `fileId`, which is converted to `https://drive.google.com/uc?export=download&id=FILE_ID` when emails are sent. Attachments are only downloaded and included when the file is smaller than ~25 MB; otherwise, the email body appends the shared URL so every recipient still receives resume access.

When starting a job you must now include the desired resume:

```
POST /jobs/start
{
  "resumeId": "<resumeId from GET /users/resumes>"
}
```

The worker reads the Drive file, attempts to download it once per job, and attaches it when the size can be determined and remains under Gmail’s 25 MB limit. If the download fails or the size is unknown/too big, the job continues but the email body gets `Resume: https://drive.google.com/…` appended instead.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
