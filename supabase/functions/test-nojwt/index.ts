
export default async (req: Request) => {
  console.log("✅ TEST ENTRY", Object.fromEntries(req.headers.entries()));
  return new Response("ok");
};
