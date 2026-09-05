import pandas as pd

FILE_PATH = "data/raw/estates.xlsx"


# 1. Check available sheets
excel_file = pd.ExcelFile(FILE_PATH)

print("Sheets:")
print(excel_file.sheet_names)


# 2. Load the Data sheet
df = pd.read_excel(FILE_PATH, sheet_name="Data")

print("\nShape:")
print(df.shape)


# 3. Show column names
print("\nColumns:")
print(df.columns.tolist())


# 4. Show data types
print("\nData types:")
print(df.dtypes)


# 5. Show first 5 rows
print("\nFirst 5 rows:")
print(df.head())


# 6. Check missing values
print("\nMissing values:")
print(df.isnull().sum())


# 7. Check duplicate rows
print("\nDuplicate rows:")
print(df.duplicated().sum())


# 8. Basic information about important columns
print("\nUnique states/UTs:")
print(df["State/UT"].nunique())

print("\nUnique fiscal years:")
print(df["Fiscal Year"].nunique())

print("\nUnique budget heads:")
print(df["Budget Head"].nunique())

print("\nUnique appendices:")
print(df["Appendix"].unique())

print("\nAppendix counts:")
print(df["Appendix"].value_counts())

print("\nFiscal years:")
print(df["Fiscal Year"].unique())

print("\nAccount examples:")
print(df["Account"].dropna().head(10).tolist())

print("\nRevised examples:")
print(df["Revised"].dropna().head(10).tolist())

print("\nBudget examples:")
print(df["Budget"].dropna().head(10).tolist())

print("\nStates/UTs:")
print(df["State/UT"].unique())

print("\nBudget head examples:")
print(df["Budget Head"].head(20).tolist())


# 9. Inspect the Note sheet
print("\nNote sheet:")

note_df = pd.read_excel(FILE_PATH, sheet_name="Note", header=None)

print(note_df.shape)

print(note_df.head(30).to_string(index=False, header=False))
