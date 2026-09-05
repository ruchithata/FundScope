import os

import pandas as pd


FILE_PATH = "data/raw/estates.xlsx"
OUTPUT_PATH = "data/processed/estates_cleaned.csv"


# 1. Load the RBI dataset
df = pd.read_excel(FILE_PATH, sheet_name="Data")

print("Dataset loaded successfully.")
print("Shape:", df.shape)


# 2. Validate required columns
required_columns = [
    "Appendix",
    "State/UT",
    "Budget Head",
    "Fiscal Year",
    "Account",
    "Revised",
    "Budget",
]

missing_columns = [
    column for column in required_columns
    if column not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing required columns: {missing_columns}"
    )

print("Column validation passed.")


# 3. Normalize column names
df.columns = df.columns.str.strip()

print("Column names normalized.")


# 4. Normalize text fields
text_columns = [
    "Appendix",
    "State/UT",
    "Budget Head",
    "Fiscal Year",
]

for column in text_columns:
    df[column] = df[column].astype("string").str.strip()

print("Text fields normalized.")


# 5. Normalize budget-head spacing
df["Budget Head"] = (
    df["Budget Head"]
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)

print("Budget head spacing normalized.")


# 6. Validate fiscal year format
fiscal_year_pattern = r"^\d{4}-\d{4}$"

invalid_fiscal_years = df.loc[
    ~df["Fiscal Year"].str.match(
        fiscal_year_pattern,
        na=False
    ),
    "Fiscal Year"
].unique()

if len(invalid_fiscal_years) > 0:
    raise ValueError(
        f"Invalid fiscal year values: {invalid_fiscal_years}"
    )

print("Fiscal year validation passed.")


# 7. Validate numeric columns
numeric_columns = [
    "Account",
    "Revised",
    "Budget",
]

for column in numeric_columns:
    df[column] = pd.to_numeric(
        df[column],
        errors="coerce"
    )

print("Numeric fields validated.")


# 8. Remove exact duplicate rows
duplicate_count = df.duplicated().sum()

if duplicate_count > 0:
    print(f"Removing {duplicate_count} duplicate rows.")
    df = df.drop_duplicates()
else:
    print("No duplicate rows found.")

print("Rows after duplicate handling:", len(df))


# 9. Preserve missing financial values
print("\nMissing financial values:")
print(df[numeric_columns].isna().sum())


# 10. Inspect negative values
print("\nNegative financial values:")

for column in numeric_columns:
    negative_count = (df[column] < 0).sum()
    print(f"{column}: {negative_count}")


# 11. Validate important categorical fields
if df["State/UT"].isna().any():
    raise ValueError("State/UT contains missing values.")

if df["Budget Head"].isna().any():
    raise ValueError("Budget Head contains missing values.")

if df["Appendix"].isna().any():
    raise ValueError("Appendix contains missing values.")

print("\nCategorical field validation passed.")


# 12. Save processed dataset
os.makedirs("data/processed", exist_ok=True)

df.to_csv(
    OUTPUT_PATH,
    index=False
)

print(f"\nCleaned dataset saved to: {OUTPUT_PATH}")
print("Final shape:", df.shape)


# 13. Final dataset information
print("\nFinal dataset information:")
df.info()

print("\nFinal columns:")
print(df.columns.tolist())
