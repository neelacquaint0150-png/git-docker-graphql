export const fakeDB = {
  "101": { id: "101", name: "Neel", role: "Fullstack Developer" },
  "102": { id: "102", name: "John", role: "Frontend Developer" }
};

export const fetchUserFromDB = async (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(fakeDB[id]);
    }, 3000);
  });
};