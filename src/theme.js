import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1565c0"
    },
    secondary: {
      main: "#2e7d32"
    },
    background: {
      default: "#f5f7fb",
      paper: "#ffffff"
    }
  },
  shape: {
    borderRadius: 16
  },
  typography: {
    fontFamily: "Inter, Roboto, Arial, sans-serif",
    h5: {
      fontWeight: 700
    },
    h6: {
      fontWeight: 700
    },
    button: {
      textTransform: "none",
      fontWeight: 600
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)"
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 12
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
        size: "small"
      }
    }
  }
});

export default theme;