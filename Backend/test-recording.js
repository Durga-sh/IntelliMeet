async function testRecording() {
  const { default: fetch } = await import("node-fetch");
  const roomId = `test-room-${Date.now()}`;
  console.log(`🧪 Testing recording for room: ${roomId}`);

  try {
    // 1. Create room
    console.log("📝 Step 1: Creating room...");
    const createResponse = await fetch(
      `http://localhost:5000/api/recording/create-room/${roomId}`,
      {
        method: "POST",
      }
    );
    const createData = await createResponse.json();
    console.log("✅ Room created:", createData);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Start recording
    console.log("🎬 Step 2: Starting recording...");
    const startResponse = await fetch(
      `http://localhost:5000/api/recording/start/${roomId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: ["test-user"] }),
      }
    );
    const startData = await startResponse.json();
    console.log("✅ Recording started:", startData);

    // Wait for recording to run
    console.log("⏳ Waiting 10 seconds for recording...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 3. Stop recording
    console.log("🛑 Step 3: Stopping recording...");
    const stopResponse = await fetch(
      `http://localhost:5000/api/recording/stop/${roomId}`,
      {
        method: "POST",
      }
    );
    const stopData = await stopResponse.json();
    console.log("✅ Recording stopped:", stopData);

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 4. Check recording status
    console.log("📊 Step 4: Checking recording status...");
    const statusResponse = await fetch(
      `http://localhost:5000/api/recording/room/${roomId}`
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log("📊 Recording status:", statusData);

      // Check if file exists
      if (statusData.data && statusData.data.localPath) {
        const fs = await import("fs");
        const path = statusData.data.localPath;

        if (fs.existsSync(path)) {
          const stats = fs.statSync(path);
          console.log(`📁 Recording file exists: ${path}`);
          console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

          if (stats.size > 0) {
            console.log("✅ SUCCESS: Recording file was created with content!");
          } else {
            console.log("⚠️  WARNING: Recording file exists but is empty");
          }
        } else {
          console.log("❌ ERROR: Recording file does not exist at path:", path);
        }
      } else {
        console.log("❌ ERROR: No local path in recording data");
      }
    } else {
      console.log("❌ ERROR: Could not get recording status");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testRecording();
