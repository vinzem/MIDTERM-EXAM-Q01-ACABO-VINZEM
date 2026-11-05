const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const dataPath = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


function readItems() {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function writeItems(items) {
  fs.writeFileSync(dataPath, JSON.stringify(items, null, 2));
}


function present(item) {
  return { ...item, status: item.claimed ? "CLAIMED" : "UNCLAIMED" };
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}



app.get("/api/items", (req, res) => {
  res.json(readItems().map(present));
});


app.get("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const item = readItems().find((i) => i.id === id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  res.json(present(item));
});

// POST /api/items
app.post("/api/items", (req, res) => {
  const body = req.body || {};


  if ("claimed" in body) {
    return res
      .status(400)
      .json({ error: "The 'claimed' field cannot be set by the user." });
  }
  if ("id" in body) {
    return res.status(400).json({ error: "The 'id' is assigned automatically." });
  }

  const required = ["item_name", "category", "location_found", "date_found"];
  const missing = required.filter(
    (f) => typeof body[f] !== "string" || body[f].trim() === ""
  );
  if (missing.length) {
    return res
      .status(400)
      .json({ error: `Missing or invalid fields: ${missing.join(", ")}.` });
  }
  if (!isValidDate(body.date_found)) {
    return res
      .status(400)
      .json({ error: "date_found must be a valid date in YYYY-MM-DD format." });
  }

  const items = readItems();
  const nextId = items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;

  const newItem = {
    id: nextId,
    item_name: body.item_name.trim(),
    category: body.category.trim(),
    location_found: body.location_found.trim(),
    date_found: body.date_found,
    claimed: false, 
  };

  items.push(newItem);
  writeItems(items);
  res.status(201).json(present(newItem));
});


app.delete("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const items = readItems();
  const index = items.findIndex((i) => i.id === id);

  if (index === -1) return res.status(404).json({ error: "Item not found." });


  if (items[index].claimed) {
    return res
      .status(403)
      .json({ error: "A claimed item cannot be deleted." });
  }

  const [removed] = items.splice(index, 1);
  writeItems(items);
  res.json({ message: "Item deleted.", item: present(removed) });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  next(err);
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Lost & Found API on port ${PORT}`));
}

module.exports = app;