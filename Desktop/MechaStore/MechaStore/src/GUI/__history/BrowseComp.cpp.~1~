#include <vcl.h>
#pragma hdrstop
#include "BrowseComp.h"
#include "../models/PortalManager.h"
#include "../models/Component.h"

extern PortalManager store;

#pragma package(smart_init)
#pragma resource "*.dfm"

TBrowseComponents *BrowseComponents;

__fastcall TBrowseComponents::TBrowseComponents(TComponent* Owner)
    : TForm(Owner)
{
}

void TBrowseComponents::ShowComponents()
{
    memoComponents->Lines->Clear();

    memoComponents->Lines->Add("--------------------------------------------------");
    memoComponents->Lines->Add(" ID | Name            | Price     | Quantity ");
    memoComponents->Lines->Add("--------------------------------------------------");

	auto comps = store.getComponents();  // get vector of components
    if (comps.empty())
    {
        memoComponents->Lines->Add("No components found!");
        memoComponents->Lines->Add("--------------------------------------------------");
        return;
    }

    for (auto &c : comps)
    {
        AnsiString line;
        line.printf("%3d | %-15s | %9.2f | %8d",
            c.getId(),
            c.getName().c_str(),
            c.getPrice(),
            c.getQuantity());

        memoComponents->Lines->Add(line);
    }

    memoComponents->Lines->Add("--------------------------------------------------");
}

void __fastcall TBrowseComponents::FormShow(TObject *Sender)
{
    ShowComponents();
}

void __fastcall TBrowseComponents::btnRefreshClick(TObject *Sender)
{
    store.loadComponents();   // reload from file (permanent storage)
    ShowComponents();
}



