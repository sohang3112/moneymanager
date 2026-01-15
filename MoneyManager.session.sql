--select DO_TYPE, count(*) from INOUTCOME group by DO_TYPE;

--select DO_TYPE, count(*) from INOUTCOME where toAssetUid <> '' group by DO_TYPE;

-- toAssetUid <> '' -> DO_TYPE=3 (count 372), DO_TYPE=4 (count 372)

