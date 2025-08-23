const register = async (req, res) => {
  const { name, email, password, phone, section } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    await sql.query`
      INSERT INTO Users (name, email, password, phone, section)
      VALUES (${name}, ${email}, ${hashed}, ${phone}, ${section})
    `;
    res.json({ success: true, message: "User registered successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error: " + err.message });
  }
};
