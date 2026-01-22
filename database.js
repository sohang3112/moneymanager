const sqliteConfig = {
    locateFile: filename => `sql.js_1.13/dist/${filename}` // sql-wasm.wasm
};
const currency = '₹';       // TODO: use currency column fetched in query instead of hardcoding
const amountColours = {Income: 'blue', Expense: 'red', Transfer: 'black'};
const dateFormat = new Intl.DateTimeFormat("en-IN", {day:"2-digit", month:"2-digit", year:"numeric", weekday:"short"});  // example: Wed, 31/12/2000

const transactionsElem = document.getElementById('transactions');

async function sqliteDatabase(file) {
    const buf = await file.arrayBuffer();
    return new SQL.Database(new Uint8Array(buf));
}

function transactionsQuery(monthNumStr, yearStr) {
    return `
    select datetime(t.UTIME / 1000, 'unixepoch') as dt,
        case
                when t.ctgUid is null then 'Transfer'
                when t.ctgUid like '-%' or subcategory.TYPE = 1 then 'Expense'   -- (Modified Balance) ctgUid negative (seems to be -4 only)
                when subcategory.TYPE = 0 then 'Income' 
        end as type,
        case 
                when t.ctgUid is null then 'Transfer'
                when t.ctgUid like '-%' then 'Modified Balance'    -- ctgUid negative (seems to be -4 only)
                when category.NAME is null then subcategory.NAME 
                else category.NAME
            end as category,
            case
                when category.NAME is null then null
                else subcategory.NAME
            end as subcategory,
            c.SYMBOL as currency,
            t.AMOUNT_ACCOUNT as amount,
            case
                when t.ctgUid is null then printf('%s -> %s', assets.NIC_NAME, toAssets.NIC_NAME)
                else assets.NIC_NAME 
            end as asset,
            t.ZCONTENT as name, 
            t.ZDATA as description
    from INOUTCOME t
    left join ZCATEGORY subcategory on subcategory.uid = t.ctgUid
    left join ZCATEGORY category on category.uid = subcategory.pUid
    join assets on assets.uid = t.assetUid
    left join ASSETS toAssets on toAssets.uid = t.toAssetUid
    join CURRENCY c on c.uid = t.currencyUid
    where t.IS_DEL = 0         -- not deleted
        and t.DO_TYPE != 4   -- not Transfer (from) [because its> duplicate Transfer (to) entry is already present]
        and t.ctgUid != ''   -- exclude Modified Balance entries where selected not to save as income/expense
        and t.WDATE like '${yearStr}-${monthNumStr}-%'
    order by t.UTIME desc
    `;
}

/** Render database query results as a table. 
 * 
 * @param {array} contents - Array of one or more fetched query table results. Each table object has columns and row values.
                    Format example: [{columns:['col1','col2',...], values:[[first row array], [second row array], ...]}]
 * @returns {string} - HTML of result table.
*/
function dbQueryResultsToTables(contents) {
    let ans = '';
    for (const {columns, values} of contents) {
        ans += '<table>';
        ans += '<thead><tr>' + columns.map(escapeHtml).map(cell => `<th>${cell}</th>`).join('') + '</tr></thead>';  // table header
        ans += '<tbody>';
        for (const row of values) {
            ans += '<tr>' + row.map(escapeHtml).map(cell => `<td>${cell}</td>`).join('') + '</tr>';   // table query result rows
        }
        ans += '</tbody>';
        ans += '</table>';
    }
    return ans;
}

function dbQueryResultToRows({columns, values}) {
    return values.map(row => Object.fromEntries(zip(columns, row)));
}

function displayTransactions(db, monthNum, year) {
    const amountTableCell = (type, amount) => `<td style="color: ${amountColours[type]}">${currency} ${amount.toFixed(2)}</td>`;
    const query = transactionsQuery(monthNum, year);
    const queryTable = db.exec(query)[0];
    const rows = dbQueryResultToRows(queryTable);    // [0] since single query result table only

    // add property formattedDate, to be used for display and sorting
    for (const row of rows) row.formattedDate = dateFormat.format(new Date(row.dt));

    let ans = '';
    for (let [dateString, dateRows] of groupByInSortedArray(rows, r => r.formattedDate)) {
        // total expenses & income for current date
        const dateExpenses = sum(dateRows.filter(r => r.type == "Expense").map(r => r.amount));
        const dateIncome = sum(dateRows.filter(r => r.type == "Income").map(r => r.amount));

        ans += '<tbody>';
        ans += `
            <tr class="transaction-date"> 
                <td>${dateString}</td> 
                ${amountTableCell("Income", dateIncome)}
                ${amountTableCell("Expense", dateExpenses)}
            </tr>
        `;
        for (const row of dateRows) {
            ans += `
                <tr class="transaction-head"> 
                    <td rowspan="${row.subcategory === null ? 2 : 1}">${row.category}</td> 
                    ${row.name === '' ? `<td rowspan="2">${row.asset}</td>` : `<td style="color: black">${row.name}</td>` } 
                    ${amountTableCell(row.type, row.amount)}
                </tr>
                <tr class="transaction-foot"> 
                    ${row.subcategory === null ? '' : `<td style="font-size: smaller">${row.subcategory}</td>`} 
                    ${row.name === '' ? '' : `<td>${row.asset}</td>`} 
                    <td></td> 
                </tr>
            `;
        }
        ans += `</tbody>`;
    }
    transactionsElem.innerHTML = ans;
}

async function initDatabase(file) {
    const today = new Date();
    const monthNumStr = new String(1 + today.getMonth()).padStart(2,'0');  // eg. '01' for January
    window.db = await sqliteDatabase(file);
    displayTransactions(db, monthNumStr, today.getFullYear());
}

async function main() {
    window.SQL = await initSqlJs(sqliteConfig);
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "") {
        await initDatabase(await fetch("MMAuto[GF260112](12-01-26-090617).mmbak"));
    }
}