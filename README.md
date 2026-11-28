# 2Learn - Back End (M01141362)

CST3144 Full Stack Development coursework. Express.js REST API for the 2Learn lessons app, using MongoDB Atlas with the native Node.js driver.

## Links

- Vue.js App - GitHub repo: https://github.com/ykay101/learnhub-frontend-M01141362
- Vue.js App - GitHub Pages: https://ykay101.github.io/learnhub-frontend-M01141362/
- Express.js App - GitHub repo: https://github.com/ykay101/learnhub-backend-M01141362
- Express.js App - all lessons (render.com): https://m01141362-backend.onrender.com/lessons

## Routes

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | /lessons | all lessons |
| PUT | /lessons/:id | update any field of a lesson, e.g. `{ "space": 3 }` |
| GET | /search?q=text | lessons where topic, location, price or space contains the text |
| POST | /orders | save a new order (with `paymentId` it is checked with Stripe and saved as paid) |
| GET | /enrolment/:lessonid | number of spaces already bought for a lesson |
| GET | /teachers | all teachers |
| GET | /teachers/:id/lessons | lessons taught by a teacher |
| GET | /images/:file | lesson image, or "Image not found!" |
| GET | /payments/config | whether card payments are on, and the Stripe publishable key |
| POST | /payments/intent | creates a Stripe payment for `{ lessonIDs, spaces }`, priced from the database |

Every request is printed to the console by the logger middleware.

## Database

Database `learnhub` with the collections `lesson`, `order` and `teacher`.

Each lesson has `topic`, `location`, `price`, `space` and `image`, plus `day`, `time`, `ageMin`, `ageMax`, `description`, `lat` and `lng`. The seed data lives in `data/lessons.js` (16 lessons, 4 teachers).

Each order has `name`, `phone`, `lessonIDs` and `spaces`, plus `status` (`paid` or `unpaid`) and `createdAt`. Paid orders also store `paymentId`, `amount` (in pence) and `cardLast4`.

## Running locally

Create `config.env` (not in the repo):

```
MONGODB_PREFIX="mongodb+srv://"
MONGODB_USERNAME="..."
MONGODB_PASSWORD="..."
MONGODB_URL="@yourcluster.mongodb.net/"
MONGODB_DB=learnhub
```

`MONGODB_DB` is optional and defaults to `learnhub`.

For card payments (Stripe test mode) also add:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Without them the app still works and orders are saved as unpaid.

Then:

```
npm install
npm run seed   # optional: resets lessons, teachers and orders
npm start
npm test       # checks the seed data
```

The server runs on port 5000 (or `PORT` if set).
