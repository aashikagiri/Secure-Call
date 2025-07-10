// Authentication handling
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form")
  const registerForm = document.getElementById("register-form")

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin)
  }

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister)
  }
})

async function handleLogin(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const data = {
    username: formData.get("username"),
    password: formData.get("password"),
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (result.success) {
      window.location.href = result.redirect
    } else {
      showMessage(result.message, "error")
    }
  } catch (error) {
    console.error("Login error:", error)
    showMessage("Login failed. Please try again.", "error")
  }
}

async function handleRegister(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const password = formData.get("password")
  const confirmPassword = formData.get("confirm-password")

  if (password !== confirmPassword) {
    showMessage("Passwords do not match", "error")
    return
  }

  const data = {
    username: formData.get("username"),
    email: formData.get("email"),
    password: password,
  }

  try {
    const response = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (result.success) {
      showMessage("Registration successful! You can now log in.", "success")
      setTimeout(() => {
        window.location.href = "/login"
      }, 2000)
    } else {
      showMessage(result.message, "error")
    }
  } catch (error) {
    console.error("Registration error:", error)
    showMessage("Registration failed. Please try again.", "error")
  }
}

function showMessage(message, type) {
  const messageElement = document.createElement("div")
  messageElement.className = `message ${type}`
  messageElement.textContent = message
  document.body.appendChild(messageElement)

  setTimeout(() => {
    document.body.removeChild(messageElement)
  }, 3000)
}
