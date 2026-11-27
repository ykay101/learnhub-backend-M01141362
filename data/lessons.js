const { areas } = require("./areas");

const list = [
  ["Maths", "Hendon", 100, "Mon", "16:00", 8, 12, "maths.svg", "Puzzles, problem solving and times tables that finally make sense."],
  ["English", "Colindale", 80, "Tue", "16:30", 7, 11, "english.svg", "Reading clubs and creative writing to grow confident storytellers."],
  ["Science", "Brent Cross", 90, "Wed", "17:00", 9, 13, "science.svg", "Hands-on experiments with real lab kit and plenty of safe fizzing."],
  ["Art", "Golders Green", 70, "Tue", "16:00", 6, 10, "art.svg", "Painting, collage and clay in a relaxed studio for young artists."],
  ["Music", "Hendon", 95, "Thu", "16:00", 7, 14, "music.svg", "Keyboard, rhythm and singing, ending each term with a small concert."],
  ["Coding", "Finchley", 120, "Thu", "17:00", 11, 15, "coding.svg", "Build real web pages and simple games with HTML and JavaScript."],
  ["Drama", "Edgware", 75, "Fri", "16:30", 8, 14, "drama.svg", "Games, improvisation and short scenes that build confidence on stage."],
  ["Chess", "Mill Hill", 60, "Wed", "16:00", 7, 15, "chess.svg", "Openings, tactics and friendly matches for beginners and improvers."],
  ["Football", "Colindale", 50, "Sat", "10:00", 6, 12, "football.svg", "Skills, teamwork and small-sided games with qualified coaches."],
  ["Swimming", "Barnet", 110, "Sat", "11:00", 5, 12, "swimming.svg", "Small groups working towards their next swimming badge."],
  ["Robotics", "Hendon", 130, "Fri", "17:00", 10, 15, "robotics.svg", "Design, build and program robots that sense and move on their own."],
  ["Dance", "Finchley", 65, "Mon", "17:00", 5, 11, "dance.svg", "Street dance and musical theatre routines full of energy."],
  ["Spanish", "Golders Green", 85, "Wed", "16:30", 7, 12, "spanish.svg", "Songs, games and conversation to start speaking Spanish fast."],
  ["Art", "Hendon", 75, "Sat", "10:30", 9, 14, "art.svg", "Drawing and illustration techniques for older children who love to sketch."],
  ["Coding", "Hendon", 100, "Tue", "17:00", 8, 11, "coding.svg", "Scratch and block coding for younger children taking their first steps."],
  ["Football", "Mill Hill", 55, "Thu", "16:30", 9, 14, "football.svg", "Match-focused training for players ready for a bit more challenge."]
];

const lessons = list.map(row => ({
  topic: row[0],
  location: row[1],
  price: row[2],
  space: 5,
  image: row[7],
  day: row[3],
  time: row[4],
  ageMin: row[5],
  ageMax: row[6],
  description: row[8],
  lat: areas[row[1]].lat,
  lng: areas[row[1]].lng
}));

const teachers = [
  { firstName: "Aoife", lastName: "Murphy", lessons: [0, 2, 5, 10, 14] },
  { firstName: "Lars", lastName: "Haugen", lessons: [1, 6, 11, 12] },
  { firstName: "Jamal", lastName: "Iris", lessons: [3, 4, 13] },
  { firstName: "Elif", lastName: "Yilmaz", lessons: [7, 8, 9, 15] }
];

module.exports = { lessons, teachers };
