"""
The statements the unit and browser tests read from their files (src/lib/sheet.ts).

Made with XlsxWriter, which writes a workbook part for part as Excel does, and
openpyxl, which writes one its own way; each as a platform or a bank gives one:
a title above the table, dates as dates, amounts as numbers, a total row. Run
again with both installed (pip install xlsxwriter openpyxl) to make them anew:

    python3 tests/statement-files/make.py
"""
import datetime
import os

import openpyxl
import xlsxwriter

HERE = os.path.dirname(os.path.abspath(__file__))


def talabat():
    """A platform's statement: two orders paid out, under a title, with a total and a note."""
    book = xlsxwriter.Workbook(os.path.join(HERE, "talabat-statement.xlsx"))
    sheet = book.add_worksheet("Statement")
    day = book.add_format({"num_format": "dd/mm/yyyy"})
    money = book.add_format({"num_format": "#,##0"})
    bold = book.add_format({"bold": True})
    sheet.write(0, 0, "Talabat vendor statement", bold)
    sheet.write(1, 0, "Period")
    sheet.write(1, 1, "2026-09-01 to 2026-09-15")
    for c, name in enumerate(["Order ID", "Order Date", "Order Value", "Commission", "Net Payout"]):
        sheet.write(3, c, name, bold)
    lines = [("FILE-7001", 3000, -450, 2550), ("FILE-7002", 6000, -900, 5100)]
    for r, (order, value, commission, payout) in enumerate(lines, start=4):
        sheet.write_string(r, 0, order)
        sheet.write_datetime(r, 1, datetime.datetime(2026, 9, 14), day)
        sheet.write_number(r, 2, value, money)
        sheet.write_number(r, 3, commission, money)
        sheet.write_number(r, 4, payout, money)
    sheet.write(6, 0, "Total", bold)
    sheet.write_formula(6, 2, "=SUM(C5:C6)", money, 9000)
    sheet.write_formula(6, 3, "=SUM(D5:D6)", money, -1350)
    sheet.write_formula(6, 4, "=SUM(E5:E6)", money, 7650)
    sheet.write(8, 0, "Generated on 30/09/2026 by the platform")
    book.close()


def bank_en():
    """A bank's statement, the newest line first, a charge the books do not have yet."""
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = "Account statement"
    sheet.append(["Account statement"])
    sheet.append(["Account", "0123-456789-001"])
    sheet.append([])
    sheet.append(["Date", "Description", "Debit", "Credit", "Balance"])
    rows = [
        (datetime.datetime(2026, 9, 16), "Bank charge", 5000, None, 1745000),
        (datetime.datetime(2026, 9, 15, 10, 32), "Card settlement", None, 250000, 1750000),
        (datetime.datetime(2026, 9, 14), "Transfer to Baghdad Dairy", 500000, None, 1500000),
        (datetime.datetime(2026, 9, 13), "Opening balance", None, None, 2000000),
    ]
    for row in rows:
        sheet.append(list(row))
    for r in range(5, 5 + len(rows)):
        sheet.cell(row=r, column=1).number_format = "DD/MM/YYYY"
        for c in (3, 4, 5):
            sheet.cell(row=r, column=c).number_format = "#,##0.00"
    book.save(os.path.join(HERE, "bank-en.xlsx"))


def bank_ar():
    """A bank's statement in Arabic, the oldest line first, its balance worked out by formulas."""
    book = xlsxwriter.Workbook(os.path.join(HERE, "bank-ar.xlsx"))
    sheet = book.add_worksheet("كشف")
    sheet.right_to_left()
    day = book.add_format({"num_format": "yyyy/mm/dd"})
    sheet.write(0, 0, "كشف حساب")
    for c, name in enumerate(["التاريخ", "البيان", "مدين", "دائن", "الرصيد"]):
        sheet.write(1, c, name)
    sheet.write_datetime(2, 0, datetime.datetime(2026, 9, 13), day)
    sheet.write(2, 1, "رصيد افتتاحي")
    sheet.write_number(2, 4, 2000000)
    lines = [
        (datetime.datetime(2026, 9, 14), "حوالة إلى ألبان بغداد", 500000, None),
        (datetime.datetime(2026, 9, 15), "تسوية بطاقات", None, 250000),
        (datetime.datetime(2026, 9, 16), "عمولة البنك", 5000, None),
    ]
    balance = 2000000
    for r, (when, what, out, into) in enumerate(lines, start=3):
        sheet.write_datetime(r, 0, when, day)
        sheet.write_string(r, 1, what)
        if out is not None:
            sheet.write_number(r, 2, out)
        if into is not None:
            sheet.write_number(r, 3, into)
        balance += (into or 0) - (out or 0)
        sheet.write_formula(r, 4, f"=E{r}+D{r + 1}-C{r + 1}", None, balance)
    sheet.write(6, 1, "المجموع")
    sheet.write_formula(6, 2, "=SUM(C4:C6)", None, 505000)
    sheet.write_formula(6, 3, "=SUM(D4:D6)", None, 250000)
    book.close()


talabat()
bank_en()
bank_ar()
