# 2Learn - Back End (M01141362)

Express.js REST API for the 2Learn lessons app, using MongoDB Atlas with the native Node.js driver.

## Links

- Vue.js App - GitHub repo: https://github.com/ykay101/learnhub-frontend-M01141362
- Vue.js App - GitHub Pages: https://ykay101.github.io/learnhub-frontend-M01141362/
- Express.js App - GitHub repo: https://github.com/ykay101/learnhub-backend-M01141362
- Express.js App - all lessons (render.com): https://m01141362-backend.onrender.com/lessons

## Routes

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | /lessons | all lessons |
| PUT | /lessons/:id | update a lesson, e.g. `{ "space": 3 }` |
| GET | /search?q=text | lessons whose topic, location or price contains the text |
| POST | /orders | save an order |
| GET | /enrolment/:lessonid | spaces already bought for a lesson |
| GET | /teachers | all teachers |
| GET | /teachers/:id/lessons | lessons taught by a teacher |
| GET | /images/:file | lesson image, or "Image not found!" |
| GET | /payments/config | Stripe publishable key for the card form |
| POST | /payments/intent | start a Stripe payment for `{ lessonIDs, spaces }` |
| POST | /auth/register | create an account |
| POST | /auth/login | sign in |
| POST | /auth/logout | sign out |
| GET | /auth/me | the signed-in parent |
| PUT | /me/profile | save phone, home area and children |
| GET | /orders/mine | the parent's bookings |
| POST | /agent/plan | AI "Plan my week" |
| POST | /agent/similar | AI alternatives for a fully booked lesson |

Signed-in routes need `Authorization: Bearer <token>`.

## Database

Database `2learn` with the collections `lesson`, `teacher`, `order`, `user`, `session` and `agent_usage`. The seed data is in `data/lessons.js`.

## Running locally

Create `config.env`:

```
MONGODB_PREFIX="mongodb+srv://"
MONGODB_USERNAME="..."
MONGODB_PASSWORD="..."
MONGODB_URL="@yourcluster.mongodb.net/"
MONGODB_DB=2learn
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
```

The Stripe and OpenAI keys are optional. Without them orders are saved as unpaid and the planner is switched off.

```
npm install
npm run seed   # resets lessons, teachers and orders
npm start      # port 5000
npm test
```
