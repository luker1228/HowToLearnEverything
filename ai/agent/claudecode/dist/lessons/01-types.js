import { pathToFileURL } from "node:url";
function formatUser(user) {
    const emailText = user.email ?? "no email";
    return `${user.name} <${emailText}> active=${user.isActive}`;
}
function activateUser(user) {
    return {
        ...user,
        isActive: true,
    };
}
export function runLesson01() {
    const rawUser = {
        id: 1,
        name: "Luke",
        isActive: false,
        age: 30,
    };
    const activeUser = activateUser(rawUser);
    console.log("Lesson 01: basic types, optional fields, and function return values");
    console.log(formatUser(activeUser));
    const scores = [90, 96, 88];
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    console.log(`Average score: ${averageScore}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runLesson01();
}
