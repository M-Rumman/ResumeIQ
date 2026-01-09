#ifndef BrowseCompH
#define BrowseCompH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
#include "../models/PortalManager.h"

class TBrowseComponents : public TForm
{
__published:
	TButton *btnRefresh;
	TMemo *memoComponents;
    void __fastcall FormShow(TObject *Sender);
    void __fastcall btnRefreshClick(TObject *Sender);

private:

    void ShowComponents();   // helper

public:
	//PortalManager *store;//OR this
    __fastcall TBrowseComponents(TComponent* Owner);
};

extern PACKAGE TBrowseComponents *BrowseComponents;

#endif
