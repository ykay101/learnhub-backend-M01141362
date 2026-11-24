# LearnHub - Back End (M01141362)

CST3144 Full Stack Development coursework. Express.js REST API for the LearnHub lessons app, using MongoDB Atlas with the native Node.js driver.

## Links

- Vue.js App - GitHub repo: https://github.com/ykay101/learnhub-frontend-M01141362
- Vue.js App - GitHub Pages: https://ykay101.github.io/learnhub-frontend-M01141362/
- Express.js App - GitHub repo: https://github.com/ykay101/learnhub-backend-M01141362
- Express.js App - all lessons (render.com): https://m01141362-learnhub.onrender.com/lessons

## Routes

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | /lessons | all lessons |
| PUT | /lessons/:id | update any field of a lesson, e.g. `{ "space": 3 }` |
| GET | /search?q=text | lessons where topic, location, price or space contains the text |
| POST | /orders | save a new order |
| GET | /enrolment/:lessonid | number of spaces already bought for a lesson |
| GET | /teachers | all teachers |
| GET | /teachers/:id/lessons | lessons taught by a teacher |
| GET | /images/:file | lesson image, or "Image not found!" |

Every request is printed to the console by the logger middleware.

## Database

Database `learnhub` with the collections `lesson`, `order` and `teacher`.

## Running locally

Create `config.env` (not in the repo):

```
MONGODB_PREFIX="mongodb+srv://"
MONGODB_USERNAME="..."
MONGODB_PASSWORD="..."
MONGODB_URL="@yourcluster.mongodb.net/"
```

Then:

```
npm install
npm run seed   # optional: resets lessons, teachers and orders
npm start
```

The server runs on port 5000 (or `PORT` if set).
